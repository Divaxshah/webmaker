import path from "node:path";
import {
  normalizeProjectPath,
} from "@/lib/project";
import { executeRuntimeAction, type RuntimeAction } from "@/lib/runtime-service";
import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";
import {
  deleteWorkspaceFiles,
  ensureWorkspaceProjectIntegrity,
  inspectWorkspace,
  listWorkspaceFilePaths,
  readWorkspaceFiles,
  renameWorkspaceFile,
  syncProjectToWorkspace,
  syncWorkspaceToProject,
  workspaceFromProject,
  writeWorkspaceFiles,
} from "@/lib/workspace";

export type AgentToolName =
  | "agent.plan"
  | "agent.inspect"
  | "agent.search"
  | "agent.read"
  | "agent.create"
  | "agent.edit"
  | "agent.patch"
  | "agent.rename"
  | "agent.delete"
  | "agent.verify"
  | "agent.complete"
  | "runtime.run_command"
  | "runtime.install_dependencies"
  | "runtime.start_preview"
  | "runtime.get_logs"
  | "runtime.verify_build"
  | "runtime.sync_workspace";

export interface AgentToolCall {
  tool: AgentToolName;
  arguments?: Record<string, unknown>;
}

export interface VerificationIssue {
  file: string;
  source: string;
}

export interface VerificationResult {
  ok: boolean;
  checks: Array<{
    label: string;
    pass: boolean;
    detail?: string;
  }>;
  unresolvedImports: VerificationIssue[];
}

interface ToolExecutionBase {
  workspace: WorkspaceSnapshot;
  project: GeneratedProject;
  toolResult: unknown;
  completedDetail: string;
  verifiedSignature: string | null;
}

export interface CompleteToolExecution extends ToolExecutionBase {
  summary: string;
}

export const MAX_SEARCH_RESULTS = 36;
export const MAX_READ_FILES = 3;
export const MAX_CREATE_FILES = 3;
export const MAX_EDIT_FILES = 1;
export const MAX_DELETE_FILES = 1;

export const TOOL_NAMES: AgentToolName[] = [
  "agent.plan",
  "agent.inspect",
  "agent.search",
  "agent.read",
  "agent.create",
  "agent.edit",
  "agent.patch",
  "agent.rename",
  "agent.delete",
  "agent.verify",
  "agent.complete",
  "runtime.run_command",
  "runtime.install_dependencies",
  "runtime.start_preview",
  "runtime.get_logs",
  "runtime.verify_build",
  "runtime.sync_workspace",
];

export const DEFAULT_VERIFY_CHECKS = [
  "entry exists",
  "imports resolve",
  "project has files",
  "dependencies align",
  "entry bootstrap exists",
];

export const getProjectSignature = (project: GeneratedProject): string =>
  JSON.stringify(
    Object.keys(project.files)
      .sort((left, right) => left.localeCompare(right))
      .map((filePath) => [
      filePath,
      project.files[filePath]?.code.length ?? 0,
    ])
  );

export const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const normalizeFilePayload = (
  value: unknown
): Array<[string, { code: string; hidden?: boolean; active?: boolean }]> => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const entries: Array<
    [string, { code: string; hidden?: boolean; active?: boolean }]
  > = [];

  const processObjectMap = (obj: Record<string, unknown>) => {
    for (const [filePath, fileValue] of Object.entries(obj)) {
      if (
        filePath === "path" ||
        filePath === "file" ||
        filePath === "code" ||
        filePath === "content"
      ) {
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
        const code =
          typeof candidate.code === "string"
            ? candidate.code
            : typeof candidate.content === "string"
              ? candidate.content
              : null;
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
        const anyItem = item as {
          path?: unknown;
          file?: unknown;
          code?: unknown;
          content?: unknown;
          hidden?: unknown;
          active?: unknown;
        };
        const code =
          typeof anyItem.code === "string"
            ? anyItem.code
            : typeof anyItem.content === "string"
              ? anyItem.content
              : null;
        const filePath =
          typeof anyItem.path === "string"
            ? anyItem.path
            : typeof anyItem.file === "string"
              ? anyItem.file
              : null;

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

export const normalizeDependencyMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
};

export const ensureProjectIntegrity = (
  project: GeneratedProject
): GeneratedProject => ensureWorkspaceProjectIntegrity(project);

export const formatToolResult = (tool: AgentToolName, result: unknown): string =>
  `Tool result for ${tool}:\n${JSON.stringify(
    result,
    null,
    2
  )}\n\nReturn the next JSON tool call only.`;

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

export const runLocalVerification = (
  project: GeneratedProject,
  requestedChecks: string[] = DEFAULT_VERIFY_CHECKS
): VerificationResult => {
  const unresolvedImports: VerificationIssue[] = [];
  const externalImports = new Set<string>();
  const importPattern =
    /(?:import\s+(?:[^"'`]+\s+from\s+)?|export\s+[^"'`]*\s+from\s+|import\s*\(\s*)["']([^"']+)["']/g;

  for (const [filePath, file] of Object.entries(project.files)) {
    const matches = file.code.matchAll(importPattern);

    for (const match of matches) {
      const source = match[1];

      if (!source || !source.startsWith(".")) {
        if (source && !source.startsWith("/") && !source.startsWith("@/")) {
          const packageName = source.startsWith("@")
            ? source.split("/").slice(0, 2).join("/")
            : source.split("/")[0];
          externalImports.add(packageName);
        }
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

    if (normalizedCheck === "dependencies align") {
      const missingDependencies = Array.from(externalImports).filter(
        (dependency) =>
          dependency !== "react" &&
          dependency !== "react-dom" &&
          !project.dependencies[dependency]
      );

      return {
        label: check,
        pass: missingDependencies.length === 0,
        detail:
          missingDependencies.length === 0
            ? undefined
            : `Missing dependency declarations for ${missingDependencies.join(", ")}.`,
      };
    }

    if (normalizedCheck === "entry bootstrap exists") {
      const entryExists = Boolean(project.files[project.entry]);
      return {
        label: check,
        pass: entryExists,
        detail: entryExists
          ? undefined
          : `The configured entry file ${project.entry} is missing.`,
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

const resolveWorkspaceForTool = (
  project: GeneratedProject,
  sessionWorkspace?: WorkspaceSnapshot | null
): WorkspaceSnapshot =>
  sessionWorkspace
    ? syncProjectToWorkspace(sessionWorkspace, project)
    : workspaceFromProject(project, "agent-loop");

export const executeAgentTool = async (
  project: GeneratedProject,
  toolCall: AgentToolCall,
  verifiedSignature: string | null,
  sessionWorkspace?: WorkspaceSnapshot | null
): Promise<ToolExecutionBase | CompleteToolExecution> => {
  let workspace = resolveWorkspaceForTool(project, sessionWorkspace);

  switch (toolCall.tool) {
    case "agent.plan": {
      const goal =
        typeof toolCall.arguments?.goal === "string" &&
        toolCall.arguments.goal.trim().length > 0
          ? toolCall.arguments.goal.trim()
          : "Plan the requested frontend build.";

      return {
        workspace,
        project,
        toolResult: { goal, status: "planned" },
        completedDetail: goal,
        verifiedSignature,
      };
    }

    case "agent.inspect": {
      const rawTargets = normalizeStringArray(toolCall.arguments?.targets);

      return {
        workspace,
        project,
        toolResult: inspectWorkspace(workspace, rawTargets),
        completedDetail:
          rawTargets.length > 0
            ? `Inspected ${rawTargets.length} requested file target${
                rawTargets.length === 1 ? "" : "s"
              }.`
            : `Inspected the full project tree with ${Object.keys(project.files).length} files.`,
        verifiedSignature,
      };
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
      const matches: Array<{ path: string; line?: number; preview: string }> = [];

      for (const filePath of listWorkspaceFilePaths(workspace)) {
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

      return {
        workspace,
        project,
        toolResult: { query, matches },
        completedDetail: `Found ${matches.length} search match${
          matches.length === 1 ? "" : "es"
        } for "${query}".`,
        verifiedSignature,
      };
    }

    case "agent.read": {
      const rawTargets = normalizeStringArray(toolCall.arguments?.targets).map((target) =>
        normalizeProjectPath(target)
      );
      if (rawTargets.length === 0) {
        throw new Error("agent.read requires at least one file target.");
      }
      const targets = rawTargets.slice(0, MAX_READ_FILES);
      const overLimit = rawTargets.length > MAX_READ_FILES;
      const readResult = readWorkspaceFiles(workspace, targets);

      return {
        workspace,
        project,
        toolResult: {
          files: readResult.files,
          missing: readResult.missing,
          ...(overLimit && {
            batchHint: `Only first ${MAX_READ_FILES} files returned. Call agent.read again with the next batch of paths (max ${MAX_READ_FILES} per call).`,
          }),
        },
        completedDetail: `Read ${targets.length} file${
          targets.length === 1 ? "" : "s"
        } for detailed editing context.`,
        verifiedSignature,
      };
    }

    case "agent.create":
    case "agent.edit": {
      const rawWrites = normalizeFilePayload(toolCall.arguments?.files);

      if (rawWrites.length === 0) {
        throw new Error(
          `${toolCall.tool} requires a non-empty files map. Ensure "arguments.files" is an object mapping absolute file paths to { code: string } or to string contents. Arrays are not accepted.`
        );
      }

      const maxFiles =
        toolCall.tool === "agent.create" ? MAX_CREATE_FILES : MAX_EDIT_FILES;
      const writes = rawWrites.slice(0, maxFiles);
      const overLimit = rawWrites.length > maxFiles;

      const writeResult = writeWorkspaceFiles(workspace, writes);
      const nextProject = syncWorkspaceToProject(writeResult.workspace);

      return {
        workspace: writeResult.workspace,
        project: nextProject,
        toolResult: {
          created: writeResult.created,
          updated: writeResult.updated,
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
        },
        completedDetail: `Wrote ${writes.length} file${
          writes.length === 1 ? "" : "s"
        } across the project workspace.`,
        verifiedSignature: null,
      };
    }

    case "agent.patch": {
      const rawPath =
        typeof toolCall.arguments?.path === "string"
          ? normalizeProjectPath(toolCall.arguments.path)
          : "";
      const search =
        typeof toolCall.arguments?.search === "string"
          ? toolCall.arguments.search
          : "";
      const replace =
        typeof toolCall.arguments?.replace === "string"
          ? toolCall.arguments.replace
          : "";
      const replaceAll = toolCall.arguments?.replaceAll === true;

      if (!rawPath || !search) {
        throw new Error(
          "agent.patch requires non-empty path and search (replace may be empty)."
        );
      }

      const existing = project.files[rawPath];
      if (!existing) {
        throw new Error(`agent.patch: missing file ${rawPath}.`);
      }

      const current = existing.code;
      if (!current.includes(search)) {
        throw new Error(`agent.patch: search string not found in ${rawPath}.`);
      }

      let nextCode: string;
      let replacedCount: number;
      if (replaceAll) {
        const parts = current.split(search);
        replacedCount = parts.length - 1;
        nextCode = parts.join(replace);
      } else {
        const idx = current.indexOf(search);
        replacedCount = 1;
        nextCode =
          current.slice(0, idx) +
          replace +
          current.slice(idx + search.length);
      }

      const writeResult = writeWorkspaceFiles(workspace, [
        [
          rawPath,
          {
            code: nextCode,
            hidden: existing.hidden,
            active: existing.active,
          },
        ],
      ]);
      const nextProject = syncWorkspaceToProject(writeResult.workspace);

      return {
        workspace: writeResult.workspace,
        project: nextProject,
        toolResult: {
          path: rawPath,
          replacedOccurrences: replacedCount,
          replaceAll,
        },
        completedDetail: `Applied targeted patch to ${rawPath}.`,
        verifiedSignature: null,
      };
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

      const nextWorkspace = renameWorkspaceFile(workspace, from, to);
      const nextProject = syncWorkspaceToProject(nextWorkspace);

      return {
        workspace: nextWorkspace,
        project: nextProject,
        toolResult: { from, to },
        completedDetail: `Renamed ${from} to ${to}.`,
        verifiedSignature: null,
      };
    }

    case "agent.delete": {
      const rawTargets = normalizeStringArray(toolCall.arguments?.targets).map((target) =>
        normalizeProjectPath(target)
      );

      if (rawTargets.length === 0) {
        throw new Error("agent.delete requires at least one target path.");
      }

      const targets = rawTargets.slice(0, MAX_DELETE_FILES);
      const overLimit = rawTargets.length > MAX_DELETE_FILES;

      const deleteResult = deleteWorkspaceFiles(workspace, targets);
      const nextProject = syncWorkspaceToProject(deleteResult.workspace);

      return {
        workspace: deleteResult.workspace,
        project: nextProject,
        toolResult: {
          deleted: deleteResult.deleted,
          missing: deleteResult.missing,
          ...(overLimit && {
            batchHint: `Only first file deleted. Call agent.delete once per file (max ${MAX_DELETE_FILES} per call).`,
          }),
        },
        completedDetail: `Deleted ${deleteResult.deleted.length} file${
          deleteResult.deleted.length === 1 ? "" : "s"
        } from the project.`,
        verifiedSignature: null,
      };
    }

    case "agent.verify": {
      const checks = normalizeStringArray(toolCall.arguments?.checks);
      const verification = runLocalVerification(
        project,
        checks.length > 0 ? checks : DEFAULT_VERIFY_CHECKS
      );

      const nextWorkspace = workspace;
      const nextProject = syncWorkspaceToProject(nextWorkspace);

      return {
        workspace: nextWorkspace,
        project: nextProject,
        toolResult: verification,
        completedDetail: verification.ok
          ? "Verified entry wiring and relative imports."
          : "Detected project issues that still need fixes.",
        verifiedSignature: verification.ok
          ? getProjectSignature(nextProject)
          : verifiedSignature,
      };
    }

    case "runtime.sync_workspace":
    case "runtime.install_dependencies":
    case "runtime.start_preview":
    case "runtime.get_logs":
    case "runtime.verify_build":
    case "runtime.run_command": {
      const runtimeActionByTool: Record<
        Extract<AgentToolName, `runtime.${string}`>,
        RuntimeAction
      > = {
        "runtime.sync_workspace": "sync_workspace",
        "runtime.install_dependencies": "install_dependencies",
        "runtime.start_preview": "start_preview",
        "runtime.get_logs": "get_logs",
        "runtime.verify_build": "verify_build",
        "runtime.run_command": "run_command",
      };

      const command =
        typeof toolCall.arguments?.command === "string"
          ? toolCall.arguments.command
          : undefined;
      const processId =
        typeof toolCall.arguments?.processId === "string"
          ? toolCall.arguments.processId
          : undefined;
      const runtimeResult = await executeRuntimeAction(
        workspace,
        runtimeActionByTool[toolCall.tool],
        { command, processId }
      );
      const nextWorkspace = runtimeResult.workspace;
      const nextProject = syncWorkspaceToProject(nextWorkspace);

      return {
        workspace: nextWorkspace,
        project: nextProject,
        toolResult: {
          ok: !runtimeResult.error,
          output: runtimeResult.output,
          error: runtimeResult.error,
          structuredErrors: runtimeResult.structuredErrors,
          runtime: nextWorkspace.runtime,
        },
        completedDetail: runtimeResult.error
          ? runtimeResult.error
          : runtimeResult.output ?? `Ran ${toolCall.tool}.`,
        verifiedSignature:
          toolCall.tool === "runtime.verify_build" && !runtimeResult.error
            ? getProjectSignature(nextProject)
            : verifiedSignature,
      };
    }

    case "agent.complete": {
      const summary =
        typeof toolCall.arguments?.summary === "string" &&
        toolCall.arguments.summary.trim().length > 0
          ? toolCall.arguments.summary.trim()
          : `Prepared ${Object.keys(project.files).length} files for ${project.title}.`;
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
      const dependencies = normalizeDependencyMap(toolCall.arguments?.dependencies);

      const nextProject = ensureProjectIntegrity({
        ...project,
        title,
        summary,
        entry: nextEntry,
        dependencies: {
          ...project.dependencies,
          ...dependencies,
        },
      });

      return {
        workspace: syncProjectToWorkspace(workspace, nextProject),
        project: nextProject,
        toolResult: {
          summary,
          title,
          entry: nextProject.entry,
          dependencies,
        },
        summary,
        completedDetail: summary,
        verifiedSignature,
      };
    }
  }
};
