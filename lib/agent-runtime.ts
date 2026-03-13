import path from "node:path";
import type OpenAI from "openai";
import type { GenerationStreamEvent } from "@/lib/agent";
import { buildSystemPrompt, getGeminiClient } from "@/lib/gemini";
import {
  createStarterProject,
  getProjectFilePaths,
  normalizeProject,
  normalizeProjectPath,
} from "@/lib/project";
import type { GeneratedProject } from "@/lib/types";
import { estimateTokenCount } from "@/lib/utils";

type AgentToolName =
  | "agent.plan"
  | "agent.inspect"
  | "agent.search"
  | "agent.read"
  | "agent.create"
  | "agent.edit"
  | "agent.rename"
  | "agent.delete"
  | "agent.verify"
  | "agent.complete";

interface AgentInputMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentToolCall {
  tool: AgentToolName;
  arguments?: Record<string, unknown>;
}

interface RunAgentLoopOptions {
  messages: AgentInputMessage[];
  currentProject: GeneratedProject | null;
  modelId: string;
  signal?: AbortSignal;
  onEvent: (event: GenerationStreamEvent) => void | Promise<void>;
}

interface VerificationIssue {
  file: string;
  source: string;
}

interface VerificationResult {
  ok: boolean;
  checks: Array<{
    label: string;
    pass: boolean;
    detail?: string;
  }>;
  unresolvedImports: VerificationIssue[];
}

const MAX_AGENT_STEPS = 24;
const MAX_SEARCH_RESULTS = 36;
const MAX_READ_FILES = 3;
const MAX_CREATE_FILES = 3;
const MAX_EDIT_FILES = 1;
const MAX_DELETE_FILES = 1;
const TOOL_NAMES: AgentToolName[] = [
  "agent.plan",
  "agent.inspect",
  "agent.search",
  "agent.read",
  "agent.create",
  "agent.edit",
  "agent.rename",
  "agent.delete",
  "agent.verify",
  "agent.complete",
];

const DEFAULT_VERIFY_CHECKS = [
  "entry exists",
  "imports resolve",
  "project has files",
];

const abortError = () => new DOMException("Generation aborted", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw abortError();
  }
};

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
        
        if (typeof parsed.tool === "string" && TOOL_NAMES.includes(parsed.tool as AgentToolName)) {
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

const getProjectSignature = (project: GeneratedProject): string =>
  JSON.stringify(
    getProjectFilePaths(project).map((filePath) => [
      filePath,
      project.files[filePath]?.code.length ?? 0,
    ])
  );

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const normalizeFilePayload = (
  value: unknown
): Array<[string, { code: string; hidden?: boolean; active?: boolean }]> => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const entries: Array<[string, { code: string; hidden?: boolean; active?: boolean }]> = [];

  const processObjectMap = (obj: Record<string, unknown>) => {
    for (const [filePath, fileValue] of Object.entries(obj)) {
      // Ignore keys that are commonly used in hallucinated array items
      if (filePath === "path" || filePath === "file" || filePath === "code" || filePath === "content") {
        continue;
      }

      const normalizedPath = normalizeProjectPath(filePath);

      if (typeof fileValue === "string") {
        entries.push([normalizedPath, { code: fileValue }]);
      } else if (fileValue && typeof fileValue === "object") {
        const candidate = fileValue as {
          code?: unknown;
          content?: unknown;
          hidden?: unknown;
          active?: unknown;
        };
        const code = typeof candidate.code === "string" ? candidate.code : typeof candidate.content === "string" ? candidate.content : null;
        if (code !== null) {
          entries.push([
            normalizedPath,
            {
              code,
              hidden: candidate.hidden === true,
              active: candidate.active === true,
            },
          ]);
        }
      }
    }
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") {
        const anyItem = item as any;
        const code = typeof anyItem.code === "string" ? anyItem.code : typeof anyItem.content === "string" ? anyItem.content : null;
        const filePath = typeof anyItem.path === "string" ? anyItem.path : typeof anyItem.file === "string" ? anyItem.file : null;
        
        if (filePath && code !== null) {
          entries.push([
            normalizeProjectPath(filePath),
            {
              code,
              hidden: anyItem.hidden === true,
              active: anyItem.active === true,
            },
          ]);
        } else {
          processObjectMap(item as Record<string, unknown>);
        }
      }
    }
  } else {
    processObjectMap(value as Record<string, unknown>);
  }

  return entries;
};

const normalizeDependencyMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
};

const ensureProjectIntegrity = (project: GeneratedProject): GeneratedProject => {
  const filePaths = Object.keys(project.files);

  if (filePaths.length === 0) {
    return createStarterProject();
  }

  const entry = project.files[project.entry]
    ? project.entry
    : project.files["/src/main.tsx"]
      ? "/src/main.tsx"
      : filePaths.sort((left, right) => left.localeCompare(right))[0];

  const nextFiles = Object.fromEntries(
    Object.entries(project.files).map(([filePath, file]) => [
      filePath,
      {
        ...file,
        active: filePath === entry,
      },
    ])
  );

  return {
    ...project,
    entry,
    files: nextFiles,
  };
};

const formatToolResult = (tool: AgentToolName, result: unknown): string =>
  `Tool result for ${tool}:\n${JSON.stringify(result, null, 2)}\n\nReturn the next JSON tool call only.`;

const appendLog = (log: string, line: string): string =>
  `${log}${log ? "\n" : ""}${line}`;

const resolveImportPath = (
  project: GeneratedProject,
  fromFile: string,
  source: string
): string | null => {
  const basePath = path.posix.dirname(fromFile);
  const absoluteSource = normalizeProjectPath(path.posix.join(basePath, source));
  const candidates = [
    absoluteSource,
    `${absoluteSource}.ts`,
    `${absoluteSource}.tsx`,
    `${absoluteSource}.js`,
    `${absoluteSource}.jsx`,
    `${absoluteSource}.css`,
    path.posix.join(absoluteSource, "index.ts"),
    path.posix.join(absoluteSource, "index.tsx"),
    path.posix.join(absoluteSource, "index.js"),
    path.posix.join(absoluteSource, "index.jsx"),
  ];

  return candidates.find((candidate) => Boolean(project.files[candidate])) ?? null;
};

const runLocalVerification = (
  project: GeneratedProject,
  requestedChecks: string[] = DEFAULT_VERIFY_CHECKS
): VerificationResult => {
  const unresolvedImports: VerificationIssue[] = [];
  const importPattern =
    /(?:import\s+(?:[^"'`]+\s+from\s+)?|export\s+[^"'`]*\s+from\s+|import\s*\(\s*)["']([^"']+)["']/g;

  for (const [filePath, file] of Object.entries(project.files)) {
    const matches = file.code.matchAll(importPattern);

    for (const match of matches) {
      const source = match[1];

      if (!source || !source.startsWith(".")) {
        continue;
      }

      if (!resolveImportPath(project, filePath, source)) {
        unresolvedImports.push({ file: filePath, source });
      }
    }
  }

  const checks = requestedChecks.map((check) => {
    const normalizedCheck = check.trim().toLowerCase();

    if (normalizedCheck === "project has files") {
      return {
        label: check,
        pass: Object.keys(project.files).length > 0,
        detail:
          Object.keys(project.files).length > 0
            ? undefined
            : "The project does not contain any files.",
      };
    }

    if (normalizedCheck === "entry exists") {
      return {
        label: check,
        pass: Boolean(project.files[project.entry]),
        detail: project.files[project.entry]
          ? undefined
          : `Missing entry file ${project.entry}.`,
      };
    }

    if (normalizedCheck === "imports resolve") {
      return {
        label: check,
        pass: unresolvedImports.length === 0,
        detail:
          unresolvedImports.length === 0
            ? undefined
            : `Found ${unresolvedImports.length} unresolved relative import${
                unresolvedImports.length === 1 ? "" : "s"
              }.`,
      };
    }

    return {
      label: check,
      pass: true,
    };
  });

  return {
    ok: checks.every((check) => check.pass),
    checks,
    unresolvedImports,
  };
};

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
                : tool === "agent.rename"
                  ? "rename"
                  : tool === "agent.delete"
                    ? "delete"
                    : tool === "agent.verify"
                      ? "verify"
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
                : tool === "agent.rename"
                  ? "Rename a file"
                  : tool === "agent.delete"
                    ? "Delete obsolete files"
                    : tool === "agent.verify"
                      ? "Verify the project"
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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  signal?: AbortSignal
) => {
  throwIfAborted(signal);

  const completion = await client.chat.completions.create({
    model: modelId,
    temperature: 0.35,
    messages,
  }, {
    signal,
  });

  const choice = completion.choices?.[0]?.message?.content;

  if (typeof choice !== "string" || choice.trim().length === 0) {
    throw new Error("Model returned an empty control response.");
  }

  return {
    content: choice,
    tokenCount:
      completion.usage?.total_tokens ?? estimateTokenCount(choice),
  };
};

export const runAgentLoop = async ({
  messages,
  currentProject,
  modelId,
  signal,
  onEvent,
}: RunAgentLoopOptions) => {
  const client = getGeminiClient();
  const systemPrompt = await buildSystemPrompt();
  let project = ensureProjectIntegrity(
    currentProject ? normalizeProject(currentProject) : createStarterProject()
  );
  let totalTokens = 0;
  let streamLog = "";
  let verifiedSignature: string | null = null;

  const conversation: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: systemPrompt },
    ...messages,
    {
      role: "user",
      content:
        `Current editable project overview:\n${summarizeProjectForAgent(project)}\n\n` +
        "Use the local tool runtime. Do not output a full project blob. " +
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

      conversation.push({ role: "assistant", content: response.content });
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

    conversation.push({
      role: "assistant",
      content: JSON.stringify(toolCall),
    });

    let toolResult: unknown;
    let completedDetail = "";

    try {
    switch (toolCall.tool) {
      case "agent.plan": {
        const goal =
          typeof toolCall.arguments?.goal === "string" &&
          toolCall.arguments.goal.trim().length > 0
            ? toolCall.arguments.goal.trim()
            : "Plan the requested frontend build.";

        toolResult = { goal, status: "planned" };
        completedDetail = goal;
        break;
      }

      case "agent.inspect": {
        const targets = normalizeStringArray(toolCall.arguments?.targets).map(
          (target) => normalizeProjectPath(target)
        );
        const files =
          targets.length > 0
            ? Object.fromEntries(
                targets
                  .filter((target) => project.files[target])
                  .map((target) => [
                    target,
                    {
                      length: project.files[target].code.length,
                    },
                  ])
              )
            : undefined;

        toolResult = {
          title: project.title,
          summary: project.summary,
          entry: project.entry,
          dependencies: project.dependencies,
          fileCount: Object.keys(project.files).length,
          files: files ?? getProjectFilePaths(project),
          missing: targets.filter((target) => !project.files[target]),
        };
        completedDetail =
          targets.length > 0
            ? `Inspected ${targets.length} requested file target${
                targets.length === 1 ? "" : "s"
              }.`
            : `Inspected the full project tree with ${Object.keys(project.files).length} files.`;
        break;
      }

      case "agent.search": {
        const query =
          typeof toolCall.arguments?.query === "string"
            ? toolCall.arguments.query.trim()
            : "";

        if (!query) {
          throw new Error("agent.search requires a query string.");
        }

        const loweredQuery = query.toLowerCase();
        const matches: Array<{ path: string; line?: number; preview: string }> =
          [];

        for (const filePath of getProjectFilePaths(project)) {
          if (matches.length >= MAX_SEARCH_RESULTS) {
            break;
          }

          if (filePath.toLowerCase().includes(loweredQuery)) {
            matches.push({
              path: filePath,
              preview: filePath,
            });
          }

          const lines = project.files[filePath].code.split("\n");
          for (let index = 0; index < lines.length; index += 1) {
            if (matches.length >= MAX_SEARCH_RESULTS) {
              break;
            }

            if (!lines[index].toLowerCase().includes(loweredQuery)) {
              continue;
            }

            matches.push({
              path: filePath,
              line: index + 1,
              preview: lines[index].trim().slice(0, 180),
            });
          }
        }

        toolResult = { query, matches };
        completedDetail = `Found ${matches.length} search match${
          matches.length === 1 ? "" : "es"
        } for "${query}".`;
        break;
      }

      case "agent.read": {
        const rawTargets = normalizeStringArray(toolCall.arguments?.targets).map(
          (target) => normalizeProjectPath(target)
        );
        if (rawTargets.length === 0) {
          throw new Error("agent.read requires at least one file target.");
        }
        const targets = rawTargets.slice(0, MAX_READ_FILES);
        const overLimit = rawTargets.length > MAX_READ_FILES;

        toolResult = {
          files: Object.fromEntries(
            targets
              .filter((target) => Boolean(project.files[target]))
              .map((target) => [target, project.files[target].code])
          ),
          missing: targets.filter((target) => !project.files[target]),
          ...(overLimit && {
            batchHint: `Only first ${MAX_READ_FILES} files returned. Call agent.read again with the next batch of paths (max ${MAX_READ_FILES} per call).`,
          }),
        };
        completedDetail = `Read ${targets.length} file${
          targets.length === 1 ? "" : "s"
        } for detailed editing context.`;
        break;
      }

      case "agent.create":
      case "agent.edit": {
        const rawWrites = normalizeFilePayload(toolCall.arguments?.files);

        if (rawWrites.length === 0) {
          throw new Error(`${toolCall.tool} requires a non-empty files map. Ensure "arguments.files" is an object mapping absolute file paths to { code: string } or to string contents. Arrays are not accepted.`);
        }

        const maxFiles = toolCall.tool === "agent.create" ? MAX_CREATE_FILES : MAX_EDIT_FILES;
        const writes = rawWrites.slice(0, maxFiles);
        const overLimit = rawWrites.length > maxFiles;

        const nextFiles = { ...project.files };
        const created: string[] = [];
        const updated: string[] = [];

        for (const [filePath, file] of writes) {
          if (nextFiles[filePath]) {
            updated.push(filePath);
          } else {
            created.push(filePath);
          }

          nextFiles[filePath] = {
            ...nextFiles[filePath],
            code: file.code,
            hidden: file.hidden ?? nextFiles[filePath]?.hidden,
            active: file.active ?? nextFiles[filePath]?.active,
          };
        }

        project = ensureProjectIntegrity({
          ...project,
          files: nextFiles,
        });

        verifiedSignature = null;
        toolResult = {
          created,
          updated,
          totalWritten: writes.length,
          intent:
            typeof toolCall.arguments?.intent === "string"
              ? toolCall.arguments.intent
              : undefined,
          ...(overLimit && {
            batchHint:
              toolCall.tool === "agent.create"
                ? `Only first ${MAX_CREATE_FILES} files written. Call agent.create again for the next batch (max ${MAX_CREATE_FILES} per call).`
                : `Only first file written. Call agent.edit once per file (max ${MAX_EDIT_FILES} per call).`,
          }),
        };
        completedDetail = `Wrote ${writes.length} file${
          writes.length === 1 ? "" : "s"
        } across the project workspace.`;
        break;
      }

      case "agent.rename": {
        const from =
          typeof toolCall.arguments?.from === "string"
            ? normalizeProjectPath(toolCall.arguments.from)
            : "";
        const to =
          typeof toolCall.arguments?.to === "string"
            ? normalizeProjectPath(toolCall.arguments.to)
            : "";

        if (!from || !to) {
          throw new Error("agent.rename requires both from and to paths.");
        }

        if (!project.files[from]) {
          throw new Error(`Cannot rename missing file ${from}.`);
        }

        if (project.files[to]) {
          throw new Error(`Cannot rename to existing file ${to}.`);
        }

        const nextFiles = { ...project.files };
        nextFiles[to] = nextFiles[from];
        delete nextFiles[from];

        project = ensureProjectIntegrity({
          ...project,
          entry: project.entry === from ? to : project.entry,
          files: nextFiles,
        });

        verifiedSignature = null;
        toolResult = { from, to };
        completedDetail = `Renamed ${from} to ${to}.`;
        break;
      }

      case "agent.delete": {
        const rawTargets = normalizeStringArray(toolCall.arguments?.targets).map(
          (target) => normalizeProjectPath(target)
        );

        if (rawTargets.length === 0) {
          throw new Error("agent.delete requires at least one target path.");
        }

        const targets = rawTargets.slice(0, MAX_DELETE_FILES);
        const overLimit = rawTargets.length > MAX_DELETE_FILES;

        const nextFiles = { ...project.files };
        const deleted: string[] = [];
        const missing: string[] = [];

        for (const target of targets) {
          if (!nextFiles[target]) {
            missing.push(target);
            continue;
          }

          delete nextFiles[target];
          deleted.push(target);
        }

        project = ensureProjectIntegrity({
          ...project,
          files: nextFiles,
        });

        verifiedSignature = null;
        toolResult = {
          deleted,
          missing,
          ...(overLimit && {
            batchHint: `Only first file deleted. Call agent.delete once per file (max ${MAX_DELETE_FILES} per call).`,
          }),
        };
        completedDetail = `Deleted ${deleted.length} file${
          deleted.length === 1 ? "" : "s"
        } from the project.`;
        break;
      }

      case "agent.verify": {
        const checks = normalizeStringArray(toolCall.arguments?.checks);
        const verification = runLocalVerification(
          project,
          checks.length > 0 ? checks : DEFAULT_VERIFY_CHECKS
        );

        if (verification.ok) {
          verifiedSignature = getProjectSignature(project);
        }

        toolResult = verification;
        completedDetail = verification.ok
          ? "Verified entry wiring and relative imports."
          : "Detected project issues that still need fixes.";
        break;
      }

      case "agent.complete": {
        const currentSignature = getProjectSignature(project);

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

        const summary =
          typeof toolCall.arguments?.summary === "string" &&
          toolCall.arguments.summary.trim().length > 0
            ? toolCall.arguments.summary.trim()
            : `Prepared ${Object.keys(project.files).length} files for ${
                project.title
              }.`;
        const title =
          typeof toolCall.arguments?.title === "string" &&
          toolCall.arguments.title.trim().length > 0
            ? toolCall.arguments.title.trim()
            : project.title;
        const nextEntry =
          typeof toolCall.arguments?.entry === "string" &&
          toolCall.arguments.entry.trim().length > 0
            ? normalizeProjectPath(toolCall.arguments.entry)
            : project.entry;
        const dependencies = normalizeDependencyMap(
          toolCall.arguments?.dependencies
        );

        project = ensureProjectIntegrity({
          ...project,
          title,
          summary,
          entry: nextEntry,
          dependencies: {
            ...project.dependencies,
            ...dependencies,
          },
        });

        completedDetail = summary;
        await onEvent({
          type: "activity",
          activity: buildActivity(
            activityId,
            toolCall.tool,
            "completed",
            completedDetail
          ),
        });

        streamLog = appendLog(streamLog, `Completed: ${summary}`);
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
          summary,
          tokenCount: totalTokens,
        });
        return;
      }
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
