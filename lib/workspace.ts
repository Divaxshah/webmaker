import {
  createStarterProject,
  getProjectFilePaths,
  normalizeProject,
  normalizeProjectPath,
} from "@/lib/project";
import type {
  GeneratedProject,
  ProjectFile,
  SkillReference,
  WorkspaceSnapshot,
} from "@/lib/types";
import {
  getRuntimeConfig,
  getRuntimeProviderLabel,
  type RuntimeProviderMode,
  type SelectableRuntimeProviderMode,
} from "@/lib/runtime-config";
/** Placeholder root for snapshots; sandbox uses this path literally, local runtime maps it under `.webmaker/workspaces`. */
export const DEFAULT_WORKSPACE_ROOT = "/workspace";

export const BUILTIN_SKILLS: SkillReference[] = [
  {
    id: "frontend-design",
    title: "Frontend Design",
    category: "design",
    summary:
      "Distinctive, production-grade interfaces; bold aesthetic direction; aligned with `.agents/skills/frontend-design`.",
    source: "builtin",
  },
  {
    id: "ui-ux-pro-max",
    title: "UI/UX Pro Max",
    category: "design",
    summary:
      "UI/UX intelligence (a11y, layout, motion, forms, charts…); aligned with `.agents/skills/ui-ux-pro-max`.",
    source: "builtin",
  },
];

/** Skill IDs enabled by default in new Studio sessions; also used when rehydrating if `activeSkillIds` was never saved. */
export const DEFAULT_ACTIVE_SKILL_IDS: string[] = BUILTIN_SKILLS.map((s) => s.id);

const cloneProjectFile = (file: ProjectFile): ProjectFile => ({
  code: file.code,
  hidden: file.hidden,
  active: file.active,
});

const cloneProject = (project: GeneratedProject): GeneratedProject => ({
  ...project,
  dependencies: { ...project.dependencies },
  files: Object.fromEntries(
    Object.entries(project.files).map(([filePath, file]) => [
      filePath,
      cloneProjectFile(file),
    ])
  ),
});

export const generateWorkspaceId = (): string =>
  `ws-${Math.random().toString(36).slice(2, 10)}`;

export const ensureWorkspaceProjectIntegrity = (
  project: GeneratedProject
): GeneratedProject => {
  const normalized = normalizeProject(project);
  const filePaths = Object.keys(normalized.files);

  if (filePaths.length === 0) {
    return createStarterProject();
  }

  const entry = normalized.files[normalized.entry]
    ? normalized.entry
    : normalized.files["/src/main.tsx"]
      ? "/src/main.tsx"
      : filePaths.sort((left, right) => left.localeCompare(right))[0];

  const files = Object.fromEntries(
    Object.entries(normalized.files).map(([filePath, file]) => [
      filePath,
      {
        ...cloneProjectFile(file),
        active: filePath === entry,
      },
    ])
  );

  return {
    ...normalized,
    entry,
    files,
  };
};

export const createWorkspaceSnapshot = (
  project?: GeneratedProject,
  workspaceId = generateWorkspaceId()
): WorkspaceSnapshot => {
  const runtimeMode = getRuntimeConfig().mode;
  return {
    id: workspaceId,
    project: ensureWorkspaceProjectIntegrity(project ?? createStarterProject()),
    runtime: {
      provider: runtimeMode,
      status: "idle",
      rootPath: DEFAULT_WORKSPACE_ROOT,
      workspaceId,
      providerLabel: getRuntimeProviderLabel(runtimeMode),
      providerMeta:
        runtimeMode === "cloudflare-sandbox"
          ? { mode: "cloudflare-sandbox" }
          : runtimeMode === "virtual"
            ? { mode: "in-memory" }
            : { mode: "local" },
      preview: {
        status: "idle",
      },
    },
    updatedAt: new Date().toISOString(),
  };
};

export const workspaceFromProject = (
  project: GeneratedProject,
  workspaceId?: string
): WorkspaceSnapshot =>
  createWorkspaceSnapshot(project, workspaceId ?? generateWorkspaceId());

/** Normalize persisted sessions onto supported runtime providers. */
export const coerceWorkspaceToSupportedProvider = (
  workspace: WorkspaceSnapshot
): WorkspaceSnapshot => {
  const runtimeConfig = getRuntimeConfig();
  const legacyProvider = workspace.runtime as { provider?: string };
  const provider: RuntimeProviderMode =
    !runtimeConfig.runtimeToolsEnabled
      ? "virtual"
      : legacyProvider.provider === "cloudflare-sandbox"
        ? "cloudflare-sandbox"
        : legacyProvider.provider === "local"
          ? "local"
          : runtimeConfig.mode;

  if (
    workspace.runtime.provider === provider &&
    workspace.runtime.providerLabel === getRuntimeProviderLabel(provider)
  ) {
    return workspace;
  }

  return {
    ...workspace,
    runtime: {
      ...workspace.runtime,
      provider,
      providerLabel: getRuntimeProviderLabel(provider),
      status: "idle",
      preview: { status: "idle" },
      providerMeta:
        provider === "cloudflare-sandbox"
          ? { mode: "cloudflare-sandbox" }
          : provider === "virtual"
            ? { mode: "in-memory" }
            : { mode: "local" },
      lastCommand: undefined,
      lastOutput: undefined,
      lastError: undefined,
    },
  };
};

export const setWorkspaceRuntimeProvider = (
  workspace: WorkspaceSnapshot,
  provider: SelectableRuntimeProviderMode
): WorkspaceSnapshot => ({
  ...workspace,
  runtime: {
    ...workspace.runtime,
    provider,
    providerLabel: getRuntimeProviderLabel(provider),
    status: "idle",
    lastCommand: undefined,
    lastOutput: undefined,
    lastError: undefined,
    lastProcessId: undefined,
    providerMeta:
      provider === "cloudflare-sandbox"
        ? {
            mode: "cloudflare-sandbox",
            transport: "sdk",
          }
        : {
            mode: "local",
          },
    preview: {
      status: "idle",
    },
  },
  updatedAt: new Date().toISOString(),
});

export const syncProjectToWorkspace = (
  workspace: WorkspaceSnapshot,
  project: GeneratedProject
): WorkspaceSnapshot => ({
  ...workspace,
  project: ensureWorkspaceProjectIntegrity(project),
  updatedAt: new Date().toISOString(),
});

export const syncWorkspaceToProject = (
  workspace: WorkspaceSnapshot
): GeneratedProject => ensureWorkspaceProjectIntegrity(workspace.project);

export const listWorkspaceFilePaths = (workspace: WorkspaceSnapshot): string[] =>
  getProjectFilePaths(workspace.project);

export const readWorkspaceFiles = (
  workspace: WorkspaceSnapshot,
  paths: string[]
): {
  files: Record<string, string>;
  missing: string[];
} => {
  const normalizedPaths = paths.map((filePath) => normalizeProjectPath(filePath));

  return {
    files: Object.fromEntries(
      normalizedPaths
        .filter((filePath) => Boolean(workspace.project.files[filePath]))
        .map((filePath) => [filePath, workspace.project.files[filePath].code])
    ),
    missing: normalizedPaths.filter((filePath) => !workspace.project.files[filePath]),
  };
};

export const inspectWorkspace = (
  workspace: WorkspaceSnapshot,
  paths?: string[]
): {
  title: string;
  summary: string;
  entry: string;
  dependencies: Record<string, string>;
  fileCount: number;
  files: string[] | Record<string, { length: number }>;
  missing: string[];
  runtime: WorkspaceSnapshot["runtime"];
} => {
  const normalizedPaths = (paths ?? []).map((filePath) =>
    normalizeProjectPath(filePath)
  );

  const files =
    normalizedPaths.length > 0
      ? Object.fromEntries(
          normalizedPaths
            .filter((filePath) => workspace.project.files[filePath])
            .map((filePath) => [
              filePath,
              { length: workspace.project.files[filePath].code.length },
            ])
        )
      : listWorkspaceFilePaths(workspace);

  return {
    title: workspace.project.title,
    summary: workspace.project.summary,
    entry: workspace.project.entry,
    dependencies: workspace.project.dependencies,
    fileCount: Object.keys(workspace.project.files).length,
    files,
    missing: normalizedPaths.filter((filePath) => !workspace.project.files[filePath]),
    runtime: workspace.runtime,
  };
};

export const writeWorkspaceFiles = (
  workspace: WorkspaceSnapshot,
  writes: Array<[string, ProjectFile]>
): {
  workspace: WorkspaceSnapshot;
  created: string[];
  updated: string[];
} => {
  const nextProject = cloneProject(workspace.project);
  const created: string[] = [];
  const updated: string[] = [];

  for (const [rawPath, file] of writes) {
    const filePath = normalizeProjectPath(rawPath);
    if (nextProject.files[filePath]) {
      updated.push(filePath);
    } else {
      created.push(filePath);
    }

    nextProject.files[filePath] = cloneProjectFile(file);
  }

  return {
    workspace: syncProjectToWorkspace(workspace, nextProject),
    created,
    updated,
  };
};

export const renameWorkspaceFile = (
  workspace: WorkspaceSnapshot,
  from: string,
  to: string
): WorkspaceSnapshot => {
  const sourcePath = normalizeProjectPath(from);
  const targetPath = normalizeProjectPath(to);
  const nextProject = cloneProject(workspace.project);

  if (!nextProject.files[sourcePath]) {
    throw new Error(`Cannot rename missing file ${sourcePath}.`);
  }

  if (nextProject.files[targetPath]) {
    throw new Error(`Cannot rename to existing file ${targetPath}.`);
  }

  nextProject.files[targetPath] = cloneProjectFile(nextProject.files[sourcePath]);
  delete nextProject.files[sourcePath];

  if (nextProject.entry === sourcePath) {
    nextProject.entry = targetPath;
  }

  return syncProjectToWorkspace(workspace, nextProject);
};

export const deleteWorkspaceFiles = (
  workspace: WorkspaceSnapshot,
  paths: string[]
): {
  workspace: WorkspaceSnapshot;
  deleted: string[];
  missing: string[];
} => {
  const nextProject = cloneProject(workspace.project);
  const deleted: string[] = [];
  const missing: string[] = [];

  for (const rawPath of paths) {
    const filePath = normalizeProjectPath(rawPath);
    if (!nextProject.files[filePath]) {
      missing.push(filePath);
      continue;
    }
    delete nextProject.files[filePath];
    deleted.push(filePath);
  }

  return {
    workspace: syncProjectToWorkspace(workspace, nextProject),
    deleted,
    missing,
  };
};
