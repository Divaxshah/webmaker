import type OpenAI from "openai";
import type { GenerationStreamEvent } from "@/lib/agent";
import {
  DEFAULT_VERIFY_CHECKS,
  ensureProjectIntegrity,
  executeAgentTool,
  formatToolResult,
  getProjectSignature,
  normalizeStringArray,
  runLocalVerification,
  type AgentToolCall,
  type AgentToolName,
  type CompleteToolExecution,
} from "@/lib/agent-tools";
import { buildSystemPrompt, getOpenRouterClient } from "@/lib/openrouter";
import { getRuntimeConfig, getRuntimeProviderLabel } from "@/lib/runtime-config";
import { validateAgentToolCall } from "@/lib/tool-contract";
import { getToolNames } from "@/lib/tool-registry";
import {
  createStarterProject,
  getProjectFilePaths,
  normalizeProject,
  requireProjectPath,
} from "@/lib/project";
import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";
import { estimateTokenCount } from "@/lib/utils";

interface AgentInputMessage {
  role: "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

type AgentConversationMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; reasoning_details?: unknown };

interface RunAgentLoopOptions {
  messages: AgentInputMessage[];
  currentProject: GeneratedProject | null;
  /** Session workspace snapshot so tool handlers merge with the same ids as Studio. */
  sessionWorkspace?: WorkspaceSnapshot | null;
  modelId: string;
  activeSkillIds?: string[];
  signal?: AbortSignal;
  onEvent: (event: GenerationStreamEvent) => void | Promise<void>;
}

const MAX_HISTORY_ASSISTANT_CHARS = 3500;

const truncateForHistory = (value: string): string =>
  value.length <= MAX_HISTORY_ASSISTANT_CHARS
    ? value
    : `${value.slice(0, MAX_HISTORY_ASSISTANT_CHARS)}…(truncated for context)`;

const MAX_AGENT_STEPS = (() => {
  const raw = process.env.WEBMAKER_MAX_AGENT_STEPS;
  const parsed = raw !== undefined && raw.trim() !== "" ? Number(raw) : 200;
  if (!Number.isFinite(parsed)) {
    return 200;
  }
  const n = Math.floor(parsed);
  return Math.min(Math.max(n, 1), 500);
})();

const abortError = () => new DOMException("Generation aborted", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw abortError();
  }
};

const pushAssistantTurn = (
  conversation: AgentConversationMessage[],
  content: string,
  reasoning_details?: unknown
) => {
  if (reasoning_details !== undefined) {
    conversation.push({ role: "assistant", content, reasoning_details });
  } else {
    conversation.push({ role: "assistant", content });
  }
};

const toConversationMessages = (
  messages: AgentInputMessage[]
): AgentConversationMessage[] =>
  messages.map((message) => {
    if (
      message.role === "assistant" &&
      message.reasoning_details !== undefined
    ) {
      return {
        role: "assistant",
        content: message.content,
        reasoning_details: message.reasoning_details,
      };
    }
    if (message.role === "user") {
      return { role: "user", content: message.content };
    }
    return { role: "assistant", content: message.content };
  });

const extractBalancedObject = (value: string, openBraceIndex: number): string | null => {
  if (value[openBraceIndex] !== "{") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openBraceIndex; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(openBraceIndex, index + 1);
      }
    }
  }

  return null;
};

const extractJsonObjects = (value: string): string[] => {
  const objects: string[] = [];
  let searchStartIndex = 0;

  while (true) {
    const startIndex = value.indexOf("{", searchStartIndex);
    if (startIndex === -1) break;

    const extracted = extractBalancedObject(value, startIndex);

    if (extracted !== null) {
      objects.push(extracted);
      searchStartIndex = startIndex + extracted.length;
    } else {
      searchStartIndex = startIndex + 1;
    }
  }

  return objects;
};

/** Anchor at `{"tool":` so we prefer the real envelope; `extractJsonObjects` still runs as a fallback. */
const TOOL_ENVELOPE_PREFIX = /\{\s*"tool"\s*:/g;

const loosenLooseJson = (value: string): string =>
  value
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*(\}|\])/g, "$1");

const collectOrderedToolJsonCandidates = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (chunk: string) => {
    const trimmed = chunk.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    out.push(trimmed);
  };

  const trimmedText = text.trim();
  if (trimmedText.startsWith("{")) {
    push(trimmedText);
  }

  let match: RegExpExecArray | null;
  const envelopeRe = new RegExp(TOOL_ENVELOPE_PREFIX.source, "g");
  while ((match = envelopeRe.exec(text)) !== null) {
    const blob = extractBalancedObject(text, match.index);
    if (blob !== null) {
      push(blob);
    }
  }

  for (const obj of extractJsonObjects(text)) {
    push(obj);
  }

  return out;
};

const summarizeInvalidControlResponse = (value: string): string => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "(empty response)";
  }

  const toolMatch = collapsed.match(/"tool"\s*:\s*"([^"\\]*)"/);
  const toolName = toolMatch?.[1];
  const n = collapsed.length;

  if (toolName && n > 280) {
    return `${toolName} payload (${n} chars) — ${collapsed.slice(0, 100)}…`;
  }

  return collapsed.length > 220 ? `${collapsed.slice(0, 217)}...` : collapsed;
};

const tryParseValidatedToolPayload = (
  rawJson: string,
  parseErrors: Set<string>
): AgentToolCall | null => {
  const variants = [rawJson, loosenLooseJson(rawJson)];

  for (const variant of variants) {
    try {
      const parsed = JSON.parse(variant) as {
        tool?: unknown;
        arguments?: unknown;
      };

      if (typeof parsed.tool !== "string") {
        parseErrors.add('JSON object missing string field "tool".');
        continue;
      }

      if (!getToolNames().includes(parsed.tool as AgentToolName)) {
        parseErrors.add(`Unsupported tool "${parsed.tool}".`);
        continue;
      }

      if (
        parsed.arguments !== undefined &&
        (parsed.arguments === null ||
          Array.isArray(parsed.arguments) ||
          typeof parsed.arguments !== "object")
      ) {
        parseErrors.add(
          `Tool "${parsed.tool}" must use an object for "arguments".`
        );
        continue;
      }

      return {
        tool: parsed.tool as AgentToolName,
        arguments:
          parsed.arguments && typeof parsed.arguments === "object"
            ? (parsed.arguments as Record<string, unknown>)
            : {},
      };
    } catch {
      parseErrors.add("Encountered JSON-like text that could not be parsed.");
    }
  }

  return null;
};

const parseToolCall = (value: string): AgentToolCall => {
  const codeBlocks = Array.from(
    value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)
  ).map((capture) => capture[1]);

  const parseErrors = new Set<string>();
  const valid: AgentToolCall[] = [];

  for (const text of [...codeBlocks, value]) {
    const candidates = collectOrderedToolJsonCandidates(text);
    for (const jsonCandidate of candidates) {
      const result = tryParseValidatedToolPayload(jsonCandidate, parseErrors);
      if (result !== null) {
        valid.push(result);
      }
    }
  }

  const deduped: AgentToolCall[] = [];
  const seenKeys = new Set<string>();
  for (const call of valid) {
    const key = JSON.stringify(call);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(call);
    }
  }

  if (deduped.length === 1) {
    return deduped[0]!;
  }

  if (deduped.length > 1) {
    throw new Error(
      "Ambiguous control response: multiple valid JSON tool objects were found. Return exactly one JSON object with \"tool\" and \"arguments\" and no extra JSON objects."
    );
  }

  const details =
    parseErrors.size > 0 ? ` Details: ${Array.from(parseErrors).join(" ")}` : "";
  throw new Error(
    `Model response did not contain a valid JSON tool call with "tool" and "arguments".${details}`
  );
};

/** Try primary body first, then optional alternates (e.g. reasoning-only when content was wrong). */
const parseToolCallWithCandidates = (
  primary: string,
  fallbacks: string[]
): AgentToolCall => {
  let lastError: unknown;
  const seen = new Set<string>();

  for (const blob of [primary, ...fallbacks]) {
    const trimmed = blob.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    try {
      return parseToolCall(trimmed);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Model response did not contain a valid JSON tool call with \"tool\" and \"arguments\".");
};

const TOOL_CALL_FUNCTION_NAME = "emit_tool_call";

const buildToolCallSchema = (runtimeToolsEnabled: boolean) => ({
  type: "function" as const,
  function: {
    name: TOOL_CALL_FUNCTION_NAME,
    description: "Emit the next Webmaker tool call.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["tool", "arguments"],
      properties: {
        tool: {
          type: "string",
          enum: getToolNames(runtimeToolsEnabled),
        },
        arguments: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  },
});

const parseFunctionArgumentsToRecord = (args: unknown): Record<string, unknown> => {
  if (args == null) {
    return {};
  }
  if (typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  if (typeof args === "string") {
    const t = args.trim();
    if (t.length === 0) {
      return {};
    }
    const parsed = JSON.parse(loosenLooseJson(t)) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("function.arguments must decode to a JSON object.");
    }
    return parsed as Record<string, unknown>;
  }
  throw new Error("function.arguments must be an object or a JSON object string.");
};

const serializeEmitToolCall = (tool: string, argumentsValue: unknown): string => {
  if (!getToolNames().includes(tool as AgentToolName)) {
    throw new Error(`Unsupported tool "${tool}" in emit_tool_call.`);
  }

  let argsRecord: Record<string, unknown> = {};
  if (argumentsValue === undefined || argumentsValue === null) {
    argsRecord = {};
  } else if (typeof argumentsValue === "object" && !Array.isArray(argumentsValue)) {
    argsRecord = argumentsValue as Record<string, unknown>;
  } else {
    throw new Error('emit_tool_call "arguments" must be a JSON object.');
  }

  return JSON.stringify({
    tool,
    arguments: argsRecord,
  });
};

const parseEmitToolCallPayload = (args: unknown): string => {
  if (args == null) {
    throw new Error("emit_tool_call is missing arguments.");
  }

  if (typeof args === "object" && !Array.isArray(args)) {
    const o = args as Record<string, unknown>;
    const tool = o.tool;
    if (typeof tool !== "string") {
      throw new Error('emit_tool_call requires string field "tool".');
    }
    return serializeEmitToolCall(tool, o.arguments);
  }

  if (typeof args === "string") {
    const t = args.trim();
    if (t.length === 0) {
      throw new Error("emit_tool_call arguments string is empty.");
    }
    const parsed = JSON.parse(loosenLooseJson(t)) as {
      tool?: unknown;
      arguments?: unknown;
    };
    if (typeof parsed.tool !== "string") {
      throw new Error('emit_tool_call JSON must include string "tool".');
    }
    return serializeEmitToolCall(parsed.tool, parsed.arguments);
  }

  throw new Error("emit_tool_call arguments must be a JSON object or JSON string.");
};

const materializeSingleStructuredToolString = (
  functionName: unknown,
  args: unknown
): string => {
  if (typeof functionName !== "string" || functionName.trim().length === 0) {
    throw new Error("Structured tool call is missing a function name.");
  }
  if (functionName === TOOL_CALL_FUNCTION_NAME) {
    return parseEmitToolCallPayload(args);
  }
  if (!getToolNames().includes(functionName as AgentToolName)) {
    throw new Error(`Unsupported function name "${functionName}".`);
  }
  return JSON.stringify({
    tool: functionName,
    arguments: parseFunctionArgumentsToRecord(args),
  });
};

const extractStructuredControlString = (
  rawMessage: ChatMessageRecord | undefined
): string | null => {
  if (!rawMessage) {
    return null;
  }

  const hasToolCalls =
    Array.isArray(rawMessage.tool_calls) && rawMessage.tool_calls.length > 0;
  const hasLegacyCall =
    rawMessage.function_call && typeof rawMessage.function_call === "object";

  if (!hasToolCalls && !hasLegacyCall) {
    return null;
  }

  if (hasToolCalls && hasLegacyCall) {
    throw new Error(
      "Model returned both tool_calls and function_call. Use a single structured tool call only."
    );
  }

  if (hasToolCalls) {
    const list = rawMessage.tool_calls as unknown[];
    if (list.length > 1) {
      throw new Error(
        "Model returned multiple tool_calls. Return exactly one tool call per turn."
      );
    }
    const record = list[0] as Record<string, unknown>;
    const fn =
      record.function && typeof record.function === "object"
        ? (record.function as Record<string, unknown>)
        : null;
    return materializeSingleStructuredToolString(fn?.name, fn?.arguments);
  }

  const fn = rawMessage.function_call as Record<string, unknown>;
  return materializeSingleStructuredToolString(fn.name, fn.arguments);
};

const normalizeAssistantMessageContent = (
  rawMessage: ChatMessageRecord | undefined
): string => {
  if (!rawMessage) {
    return "";
  }
  const c = rawMessage.content;
  if (typeof c === "string") {
    return c.trim();
  }
  if (Array.isArray(c)) {
    const parts: string[] = [];
    for (const part of c) {
      if (typeof part === "string") {
        parts.push(part);
      } else if (part && typeof part === "object") {
        const p = part as Record<string, unknown>;
        if (typeof p.text === "string") {
          parts.push(p.text);
        } else if (typeof p.content === "string") {
          parts.push(p.content);
        } else {
          collectTextFromUnknown(part, parts);
        }
      }
    }
    return parts.join("\n").trim();
  }
  return "";
};

const summarizeProjectForAgent = (project: GeneratedProject): string => {
  return JSON.stringify(
    {
      title: project.title,
      summary: project.summary,
      framework: project.framework,
      entry: project.entry,
      dependencies: project.dependencies,
      fileCount: Object.keys(project.files).length,
      files: getProjectFilePaths(project),
    },
    null,
    2
  );
};

const appendLog = (log: string, line: string): string =>
  `${log}${log ? "\n" : ""}${line}`;

const buildActivity = (
  id: string,
  tool: AgentToolName,
  status: "active" | "completed" | "error",
  detail: string,
  targets?: string[]
) => {
  const kind =
    tool === "agent.plan"
      ? "plan"
      : tool === "agent.inspect"
        ? "inspect"
        : tool === "agent.search"
          ? "search"
          : tool === "agent.read"
            ? "read"
            : tool === "agent.create"
              ? "create"
              : tool === "agent.edit"
                ? "edit"
                : tool === "agent.patch"
                  ? "patch"
                  : tool === "agent.rename"
                    ? "rename"
                    : tool === "agent.delete"
                      ? "delete"
                      : tool === "agent.verify"
                        ? "verify"
                        : tool.startsWith("runtime.")
                          ? "runtime"
                        : "complete";

  const title =
    tool === "agent.plan"
      ? "Plan the build"
      : tool === "agent.inspect"
        ? "Inspect the project"
        : tool === "agent.search"
          ? "Search the project"
          : tool === "agent.read"
            ? "Read target files"
            : tool === "agent.create"
              ? "Create project files"
              : tool === "agent.edit"
                ? "Edit project files"
                : tool === "agent.patch"
                  ? "Patch a file"
                  : tool === "agent.rename"
                    ? "Rename a file"
                    : tool === "agent.delete"
                      ? "Delete obsolete files"
                      : tool === "agent.verify"
                        ? "Verify the project"
                        : tool === "runtime.sync_workspace"
                          ? "Sync runtime workspace"
                          : tool === "runtime.install_dependencies"
                            ? "Install dependencies"
                            : tool === "runtime.run_command"
                              ? "Run runtime command"
                              : tool === "runtime.start_preview"
                                ? "Start runtime preview"
                                : tool === "runtime.get_logs"
                                  ? "Read runtime logs"
                                  : tool === "runtime.verify_build"
                                    ? "Verify runtime build"
                        : "Finalize the result";

  return {
    id,
    kind,
    status,
    title,
    detail,
    tool,
    targets,
  } as const;
};

type ChatMessageRecord = Record<string, unknown>;

const collectTextFromUnknown = (value: unknown, out: string[]): void => {
  if (value == null) {
    return;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      out.push(trimmed);
    }
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTextFromUnknown(entry, out);
    }
    return;
  }
  if (typeof value === "object") {
    const record = value as ChatMessageRecord;
    for (const key of ["text", "content", "reasoning", "message", "value", "summary"] as const) {
      if (key in record) {
        collectTextFromUnknown(record[key], out);
      }
    }
    if ("details" in record) {
      collectTextFromUnknown(record.details, out);
    }
    if ("data" in record) {
      collectTextFromUnknown(record.data, out);
    }
  }
};

const extractReasoningText = (rawMessage: ChatMessageRecord | undefined): string => {
  if (!rawMessage) {
    return "";
  }
  const fromReasoning: string[] = [];
  const reasoningKeys = ["reasoning_details", "reasoning", "reasoning_content"] as const;
  for (const key of reasoningKeys) {
    if (key in rawMessage) {
      collectTextFromUnknown(rawMessage[key], fromReasoning);
    }
  }
  return fromReasoning.join("\n").trim();
};

/**
 * Use assistant `content` alone when present; never append reasoning into the same string.
 * Merging broke parsing (duplicate / mis-ordered JSON) and bloated retries in chat history.
 */
const resolveAssistantBodies = (
  rawMessage: ChatMessageRecord | undefined
): { assistantContent: string; altParseBodies: string[] } => {
  if (!rawMessage) {
    return { assistantContent: "", altParseBodies: [] };
  }

  const structured = extractStructuredControlString(rawMessage);
  if (structured !== null) {
    return { assistantContent: structured, altParseBodies: [] };
  }

  const trimmedContent = normalizeAssistantMessageContent(rawMessage);

  const reasoningText = extractReasoningText(rawMessage);

  if (trimmedContent.length === 0) {
    return { assistantContent: reasoningText, altParseBodies: [] };
  }

  if (reasoningText.length === 0 || reasoningText === trimmedContent) {
    return { assistantContent: trimmedContent, altParseBodies: [] };
  }

  return { assistantContent: trimmedContent, altParseBodies: [reasoningText] };
};

const callModel = async (
  client: OpenAI,
  modelId: string,
  messages: AgentConversationMessage[],
  runtimeToolsEnabled: boolean,
  signal?: AbortSignal
) => {
  throwIfAborted(signal);

  const runCompletion = async (includeReasoning: boolean) => {
    throwIfAborted(signal);
    const base = {
      model: modelId,
      temperature: 0.35,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      tools: [buildToolCallSchema(runtimeToolsEnabled)],
      tool_choice: "required" as const,
    };
    const body = (
      includeReasoning
        ? { ...base, reasoning: { enabled: true as const } }
        : base
    ) as OpenAI.ChatCompletionCreateParamsNonStreaming;
    return client.chat.completions.create(body, { signal });
  };

  try {
    let completion = await runCompletion(true);
    let rawMessage = completion.choices?.[0]?.message as unknown as
      | ChatMessageRecord
      | undefined;

    const refusal =
      rawMessage !== undefined &&
      typeof rawMessage.refusal === "string" &&
      rawMessage.refusal.trim().length > 0
        ? rawMessage.refusal.trim()
        : "";

    let bodies =
      refusal.length > 0
        ? { assistantContent: "", altParseBodies: [] as string[] }
        : resolveAssistantBodies(rawMessage);

    let choice = bodies.assistantContent;
    let altParseBodies = bodies.altParseBodies;

    if (refusal.length === 0 && choice.length === 0) {
      completion = await runCompletion(false);
      rawMessage = completion.choices?.[0]?.message as unknown as
        | ChatMessageRecord
        | undefined;
      const retryRefusal =
        rawMessage !== undefined &&
        typeof rawMessage.refusal === "string" &&
        rawMessage.refusal.trim().length > 0
          ? rawMessage.refusal.trim()
          : "";
      if (retryRefusal.length > 0) {
        throw new Error(`Model refused: ${retryRefusal}`);
      }
      bodies = resolveAssistantBodies(rawMessage);
      choice = bodies.assistantContent;
      altParseBodies = bodies.altParseBodies;
    } else if (refusal.length > 0) {
      throw new Error(`Model refused: ${refusal}`);
    }

    if (choice.trim().length === 0) {
      throw new Error(
        "Model returned an empty control response (no content or extractable reasoning text)."
      );
    }

    return {
      content: choice,
      altParseBodies,
      tokenCount:
        completion.usage?.total_tokens ?? estimateTokenCount(choice),
      reasoning_details: rawMessage?.reasoning_details as unknown,
    };
  } catch (error) {
    throwIfAborted(signal);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Unknown model transport error.";
    throw new Error(`Model request failed: ${message}`);
  }
};

export const runAgentLoop = async ({
  messages,
  currentProject,
  sessionWorkspace = null,
  modelId,
  activeSkillIds = [],
  signal,
  onEvent,
}: RunAgentLoopOptions) => {
  const client = getOpenRouterClient();
  const runtimeConfig = getRuntimeConfig();
  const activeRuntimeProvider =
    sessionWorkspace?.runtime.provider ?? runtimeConfig.mode;
  const runtimeToolsEnabled = activeRuntimeProvider !== "virtual";
  const systemPrompt = await buildSystemPrompt(
    activeSkillIds,
    runtimeToolsEnabled
  );
  let project = ensureProjectIntegrity(
    currentProject ? normalizeProject(currentProject) : createStarterProject()
  );
  let totalTokens = 0;
  let streamLog = "";
  let verifiedSignature: string | null = null;
  let buildVerifiedSignature: string | null = null;

  const conversation: AgentConversationMessage[] = [
    { role: "system", content: systemPrompt },
    ...toConversationMessages(messages),
    {
      role: "user",
      content:
        `Current editable project overview:\n${summarizeProjectForAgent(project)}\n\n` +
        `Active runtime provider: ${
          activeRuntimeProvider
        } (${getRuntimeProviderLabel(activeRuntimeProvider)}).\n` +
        (runtimeToolsEnabled
          ? "For local runtime, runtime.run_command is restricted to the documented npm allowlist.\nFor cloudflare-sandbox runtime, use Cloudflare Sandbox semantics: sandbox.exec() for one-shot commands, sandbox.startProcess() for long-running processes, sandbox.getProcessLogs()/sandbox.streamProcessLogs() for logs, sandbox.createCodeContext()+sandbox.runCode() for interpreter execution, sandbox.terminal() for terminal websockets, and sandbox.wsConnect() for websocket services.\n"
          : "Runtime tools are disabled in this hosted deployment. Do not call runtime.* tools; use only agent tools plus browser-side preview.\n") +
        "Do not output a full project blob. " +
        "Return exactly one JSON tool call per turn.",
    },
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    throwIfAborted(signal);

    let response: Awaited<ReturnType<typeof callModel>>;
    try {
      response = await callModel(
        client,
        modelId,
        conversation,
        runtimeToolsEnabled,
        signal
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Model request failed.";
      streamLog = appendLog(streamLog, errorMessage);
      await onEvent({
        type: "delta",
        tail: streamLog.slice(-240),
        tokenCount: totalTokens,
      });
      conversation.push({
        role: "user",
        content:
          `${errorMessage}\nRetry: return exactly one \`emit_tool_call\` or a single JSON object with "tool" and "arguments".`,
      });
      continue;
    }
    totalTokens += response.tokenCount;

    let toolCall: AgentToolCall;

    try {
      toolCall = parseToolCallWithCandidates(
        response.content,
        response.altParseBodies
      );
      if (!runtimeToolsEnabled && toolCall.tool.startsWith("runtime.")) {
        throw new Error(
          "Runtime tools are disabled for this deployment. Use agent.verify and agent.complete instead."
        );
      }
      validateAgentToolCall(toolCall);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Invalid JSON tool call.";
      streamLog = appendLog(
        streamLog,
        `Invalid control response from model: ${errorMessage}`
      );
      streamLog = appendLog(
        streamLog,
        `Bad control response snippet: ${summarizeInvalidControlResponse(
          response.content
        )}`
      );
      await onEvent({
        type: "delta",
        tail: streamLog.slice(-240),
        tokenCount: totalTokens,
      });

      pushAssistantTurn(
        conversation,
        truncateForHistory(response.content),
        response.reasoning_details
      );
      conversation.push({
        role: "user",
        content:
          `${errorMessage}\nReturn exactly one valid tool call. Prefer the API \`emit_tool_call\` function. Text fallback: a single JSON object with "tool" and "arguments" (markdown code fences are tolerated as a last resort). Do not add prose outside the tool call.`,
      });
      continue;
    }

    const activityId = `step-${step + 1}-${toolCall.tool.replace("agent.", "")}`;
    const rawTargets = normalizeStringArray(toolCall.arguments?.targets);
    const fileTargets =
      rawTargets.length > 0
        ? rawTargets
        : Object.keys(
            (toolCall.arguments?.files as Record<string, unknown> | undefined) ?? {}
          );
    const activityTargets =
      toolCall.tool === "agent.rename"
        ? [
            ...(typeof toolCall.arguments?.from === "string"
              ? [requireProjectPath(toolCall.arguments.from, "from")]
              : []),
            ...(typeof toolCall.arguments?.to === "string"
              ? [requireProjectPath(toolCall.arguments.to, "to")]
              : []),
          ]
        : toolCall.tool === "agent.patch" &&
            typeof toolCall.arguments?.path === "string"
          ? [requireProjectPath(toolCall.arguments.path, "path")]
          : fileTargets.length > 0
            ? fileTargets.map((target) => requireProjectPath(target, "path"))
            : undefined;

    await onEvent({
      type: "activity",
      activity: buildActivity(
        activityId,
        toolCall.tool,
        "active",
        "Running the selected tool.",
        activityTargets
      ),
    });

    pushAssistantTurn(
      conversation,
      JSON.stringify(toolCall),
      response.reasoning_details
    );

    let toolResult: unknown;
    let completedDetail = "";

    try {
      if (toolCall.tool === "agent.complete") {
        const currentSignature = getProjectSignature(project);

        if (runtimeToolsEnabled && buildVerifiedSignature !== currentSignature) {
          streamLog = appendLog(
            streamLog,
            "Runtime build verification is required before completion."
          );
          await onEvent({
            type: "delta",
            tail: streamLog.slice(-240),
            tokenCount: totalTokens,
          });

          conversation.push({
            role: "user",
            content:
              "Before calling agent.complete, run runtime.sync_workspace, runtime.install_dependencies if needed, and runtime.verify_build. Fix any build errors before completing.",
          });

          await onEvent({
            type: "activity",
            activity: buildActivity(
              activityId,
              toolCall.tool,
              "completed",
              "Completion paused until runtime build verification passes."
            ),
          });
          continue;
        }

        if (verifiedSignature !== currentSignature) {
          const verification = runLocalVerification(project, DEFAULT_VERIFY_CHECKS);
          const autoVerifyId = `${activityId}-auto-verify`;

          await onEvent({
            type: "activity",
            activity: buildActivity(
              autoVerifyId,
              "agent.verify",
              "completed",
              verification.ok
                ? "Ran the final local verification checks."
                : "Final verification found unresolved issues that need fixes."
            ),
          });

          streamLog = appendLog(
            streamLog,
            verification.ok
              ? "Final local verification passed."
              : "Final local verification failed. Requested a follow-up fix."
          );
          await onEvent({
            type: "delta",
            tail: streamLog.slice(-240),
            tokenCount: totalTokens,
          });

          if (!verification.ok) {
            conversation.push({
              role: "user",
              content:
                `${formatToolResult("agent.verify", verification)}\n` +
                "Fix the reported issues before calling agent.complete again.",
            });

            await onEvent({
              type: "activity",
              activity: buildActivity(
                activityId,
                toolCall.tool,
                "completed",
                "Completion paused until verification issues are resolved."
              ),
            });
            continue;
          }

          verifiedSignature = currentSignature;
        }

        const completion = (await executeAgentTool(
          project,
          toolCall,
          verifiedSignature,
          sessionWorkspace
        )) as CompleteToolExecution;
        project = completion.project;
        toolResult = completion.toolResult;
        completedDetail = completion.completedDetail;
        verifiedSignature = completion.verifiedSignature;
        await onEvent({
          type: "activity",
          activity: buildActivity(
            activityId,
            toolCall.tool,
            "completed",
            completedDetail
          ),
        });

        streamLog = appendLog(streamLog, `Completed: ${completion.summary}`);
        await onEvent({
          type: "delta",
          tail: streamLog.slice(-240),
          tokenCount: totalTokens,
        });
        await onEvent({
          type: "project",
          project,
        });
        await onEvent({
          type: "complete",
          project,
          summary: completion.summary,
          tokenCount: totalTokens,
        });
        return;
      }

      const execution = await executeAgentTool(
        project,
        toolCall,
        verifiedSignature,
        sessionWorkspace
      );
      project = execution.project;
      toolResult = execution.toolResult;
      completedDetail = execution.completedDetail;
      verifiedSignature = execution.verifiedSignature;

      if (
        toolCall.tool === "agent.create" ||
        toolCall.tool === "agent.edit" ||
        toolCall.tool === "agent.patch" ||
        toolCall.tool === "agent.rename" ||
        toolCall.tool === "agent.delete"
      ) {
        buildVerifiedSignature = null;
      }

      if (toolCall.tool === "runtime.verify_build") {
        const result = toolResult as { ok?: unknown; error?: unknown };
        buildVerifiedSignature =
          result.ok === true && !result.error ? getProjectSignature(project) : null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      streamLog = appendLog(
        streamLog,
        `Tool execution failed for ${toolCall.tool}: ${errorMessage}`
      );
      await onEvent({
        type: "delta",
        tail: streamLog.slice(-240),
        tokenCount: totalTokens,
      });
      await onEvent({
        type: "activity",
        activity: buildActivity(
          activityId,
          toolCall.tool,
          "error",
          errorMessage,
          activityTargets
        ),
      });

      conversation.push({
        role: "user",
        content: `Tool execution failed for ${toolCall.tool}:\n${errorMessage}\n\nFix the arguments and try again.`,
      });
      continue;
    }

    await onEvent({
      type: "activity",
      activity: buildActivity(
        activityId,
        toolCall.tool,
        "completed",
        completedDetail,
        activityTargets
      ),
    });

    streamLog = appendLog(streamLog, `${toolCall.tool}: ${completedDetail}`);
    await onEvent({
      type: "delta",
      tail: streamLog.slice(-240),
      tokenCount: totalTokens,
    });

    if (
      toolCall.tool === "agent.create" ||
      toolCall.tool === "agent.edit" ||
      toolCall.tool === "agent.rename" ||
      toolCall.tool === "agent.delete"
    ) {
      await onEvent({
        type: "project",
        project,
      });
    }

    conversation.push({
      role: "user",
      content: formatToolResult(toolCall.tool, toolResult),
    });
  }

  const summary =
    "Stopped after reaching the internal agent step limit before completion.";

  await onEvent({
    type: "project",
    project,
  });
  await onEvent({
    type: "complete",
    project,
    summary,
    tokenCount: totalTokens,
  });
};
