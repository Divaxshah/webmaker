import type { WorkspaceSnapshot } from "@/lib/types";
import {
  getWorkspaceProvider,
  type RuntimeIssue,
} from "@/lib/workspace-provider";

export type RuntimeAction =
  | "status"
  | "start_preview"
  | "stop_preview"
  | "run_command"
  | "install_dependencies"
  | "sync_workspace"
  | "get_logs"
  | "verify_build";

export interface RuntimeActionResult {
  workspace: WorkspaceSnapshot;
  output?: string;
  error?: string;
  structuredErrors?: RuntimeIssue[];
}

const withError = (
  workspace: WorkspaceSnapshot,
  error: string
): RuntimeActionResult => ({
  workspace: {
    ...workspace,
    runtime: {
      ...workspace.runtime,
      status: "error",
      lastError: error,
      lastOutput: undefined,
      preview: {
        ...workspace.runtime.preview,
        status:
          workspace.runtime.preview.status === "ready"
            ? workspace.runtime.preview.status
            : "error",
        error,
      },
    },
  },
  error,
});

export const getRuntimeStatus = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  const loaded = await provider.loadWorkspace(workspace);

  return {
    workspace: {
      ...loaded,
      runtime: {
        ...loaded.runtime,
        status: "ready",
        lastError: undefined,
        lastOutput: undefined,
        providerMeta: {
          ...(loaded.runtime.providerMeta ?? {}),
          mode:
            loaded.runtime.provider === "cloudflare-sandbox"
              ? "cloudflare-sandbox-ready"
              : loaded.runtime.provider === "local"
                ? "local-ready"
                : "virtual-ready",
        },
      },
    },
    output: "Ready.",
  };
};

export const startPreview = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  if (!provider.startPreview) {
    return withError(workspace, "Runtime provider does not support preview.");
  }

  const result = await provider.startPreview(workspace);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const stopPreview = async (
  workspace: WorkspaceSnapshot,
  processId?: string
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  if (!provider.stopPreview) {
    return withError(workspace, "Runtime provider does not support stopping previews.");
  }

  const result = await provider.stopPreview(workspace, processId);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const runWorkspaceCommand = async (
  workspace: WorkspaceSnapshot,
  command: string
): Promise<RuntimeActionResult> => {
  const trimmed = command.trim();
  if (!trimmed) {
    return withError(workspace, "Command cannot be empty.");
  }

  const provider = getWorkspaceProvider(workspace);
  if (!provider.runCommand) {
    return withError(workspace, "Runtime provider does not support command execution.");
  }

  const result = await provider.runCommand(workspace, trimmed);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const pushWorkspaceToSandbox = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  if (!provider.syncWorkspace) {
    return {
      workspace,
      output: "OK.",
    };
  }

  const result = await provider.syncWorkspace(workspace);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const fetchSandboxProcessLogs = async (
  workspace: WorkspaceSnapshot,
  processId?: string
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  if (!provider.getLogs) {
    return {
      workspace,
      output: "No runtime logs.",
    };
  }

  const result = await provider.getLogs(workspace, processId);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const verifyWorkspaceBuild = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  if (!provider.verifyBuild) {
    return withError(workspace, "Runtime provider does not support build verification.");
  }

  const result = await provider.verifyBuild(workspace);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const installWorkspaceDependencies = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  const provider = getWorkspaceProvider(workspace);
  if (!provider.installDependencies) {
    return runWorkspaceCommand(workspace, "npm install");
  }

  const result = await provider.installDependencies(workspace);
  return {
    workspace: result.workspace,
    output: result.output,
    error: result.error,
    structuredErrors: result.structuredErrors,
  };
};

export const executeRuntimeAction = async (
  workspace: WorkspaceSnapshot,
  action: RuntimeAction,
  options?: { command?: string; processId?: string }
): Promise<RuntimeActionResult> => {
  switch (action) {
    case "status":
      return getRuntimeStatus(workspace);
    case "start_preview":
      return startPreview(workspace);
    case "stop_preview":
      return stopPreview(workspace, options?.processId);
    case "run_command":
      return runWorkspaceCommand(workspace, options?.command ?? "");
    case "install_dependencies":
      return installWorkspaceDependencies(workspace);
    case "sync_workspace":
      return pushWorkspaceToSandbox(workspace);
    case "get_logs":
      return fetchSandboxProcessLogs(workspace, options?.processId);
    case "verify_build":
      return verifyWorkspaceBuild(workspace);
  }
};
