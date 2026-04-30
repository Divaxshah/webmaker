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
import { getToolNames } from "@/lib/tool-registry";
import {
  createStarterProject,
  getProjectFilePaths,
  normalizeProject,
  normalizeProjectPath,
} from "@/lib/project";
import { getRuntimeProviderLabel } from "@/lib/runtime-config";
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

const MAX_AGENT_STEPS = 24;

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

const extractJsonObjects = (value: string): string[] => {
  const objects: string[] = [];
  let searchStartIndex = 0;
  
  while (true) {
    const startIndex = value.indexOf("{", searchStartIndex);
    if (startIndex === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let foundCompleteObject = false;

    for (let index = startIndex; index < value.length; index += 1) {
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
          objects.push(value.slice(startIndex, index + 1));
          searchStartIndex = index + 1;
          foundCompleteObject = true;
          break;
        }
      }
    }
    
    if (!foundCompleteObject) {
      searchStartIndex = startIndex + 1;
    }
  }
  
  return objects;
};

const parseToolCall = (value: string): AgentToolCall => {
  const codeBlocks = Array.from(value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)).map(m => m[1]);
  const candidatesToSearch = [...codeBlocks, value];
  
  for (const text of candidatesToSearch) {
    const jsonObjects = extractJsonObjects(text);
    for (const jsonObj of jsonObjects) {
      try {
        const parsed = JSON.parse(jsonObj) as {
          tool?: unknown;
          arguments?: unknown;
        };
        
        if (
          typeof parsed.tool === "string" &&
          getToolNames().includes(parsed.tool as AgentToolName)
        ) {
          return {
            tool: parsed.tool as AgentToolName,
            arguments: parsed.arguments && typeof parsed.arguments === "object" ? (parsed.arguments as Record<string, unknown>) : {},
          };
        }
      } catch {
        // Not a valid JSON or not a tool call, continue searching
      }
    }
  }

  throw new Error("Model response did not contain a valid JSON tool call with 'tool' and 'arguments'.");
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

const callModel = async (
  client: OpenAI,
  modelId: string,
  messages: AgentConversationMessage[],
  signal?: AbortSignal
) => {
  throwIfAborted(signal);

  const completion = await client.chat.completions.create(
    {
      model: modelId,
      temperature: 0.35,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      reasoning: { enabled: true },
    } as OpenAI.ChatCompletionCreateParamsNonStreaming,
    { signal }
  );

  const rawMessage = completion.choices?.[0]?.message as
    | (OpenAI.ChatCompletionMessage & { reasoning_details?: unknown })
    | undefined;
  const choice = rawMessage?.content;

  if (typeof choice !== "string" || choice.trim().length === 0) {
    throw new Error("Model returned an empty control response.");
  }

  return {
    content: choice,
    tokenCount:
      completion.usage?.total_tokens ?? estimateTokenCount(choice),
    reasoning_details: rawMessage?.reasoning_details,
  };
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
  const systemPrompt = await buildSystemPrompt(activeSkillIds);
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
          sessionWorkspace?.runtime.provider ?? "local"
        } (${getRuntimeProviderLabel(sessionWorkspace?.runtime.provider ?? "local")}).\n` +
        "For local runtime, runtime.run_command is restricted to the documented npm allowlist.\n" +
        "For cloudflare-sandbox runtime, use Cloudflare Sandbox semantics: sandbox.exec() for one-shot commands, sandbox.startProcess() for long-running processes, sandbox.getProcessLogs()/sandbox.streamProcessLogs() for logs, sandbox.createCodeContext()+sandbox.runCode() for interpreter execution, sandbox.terminal() for terminal websockets, and sandbox.wsConnect() for websocket services.\n" +
        "Do not output a full project blob. " +
        "Return exactly one JSON tool call per turn.",
    },
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    throwIfAborted(signal);

    const response = await callModel(client, modelId, conversation, signal);
    totalTokens += response.tokenCount;

    let toolCall: AgentToolCall;

    try {
      toolCall = parseToolCall(response.content);
    } catch (error) {
      streamLog = appendLog(
        streamLog,
        "Invalid control response from model. Requested a corrected tool call."
      );
      await onEvent({
        type: "delta",
        tail: streamLog.slice(-240),
        tokenCount: totalTokens,
      });

      pushAssistantTurn(
        conversation,
        response.content,
        response.reasoning_details
      );
      conversation.push({
        role: "user",
        content:
          `${
            error instanceof Error ? error.message : "Invalid JSON tool call."
          }\nReturn exactly one valid JSON object with "tool" and "arguments".`,
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
              ? [normalizeProjectPath(toolCall.arguments.from)]
              : []),
            ...(typeof toolCall.arguments?.to === "string"
              ? [normalizeProjectPath(toolCall.arguments.to)]
              : []),
          ]
        : toolCall.tool === "agent.patch" &&
            typeof toolCall.arguments?.path === "string"
          ? [normalizeProjectPath(toolCall.arguments.path)]
          : fileTargets.length > 0
            ? fileTargets.map((target) => normalizeProjectPath(target))
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

        if (buildVerifiedSignature !== currentSignature) {
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
        `Tool execution failed: ${errorMessage}`
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
        content: `Tool execution failed:\n${errorMessage}\n\nFix the arguments and try again.`,
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
