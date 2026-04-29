import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";
import {
  sandboxGatewayExec,
  sandboxGatewayProcessLogs,
  sandboxGatewayStartPreview,
  sandboxGatewayStatus,
  sandboxGatewayStopPreview,
  sandboxGatewaySyncProject,
} from "@/lib/sandbox-gateway-client";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { getWorkspaceProvider } from "@/lib/workspace-provider";

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
}

const OUTPUT_LIMIT = 14_000;

const truncateOutput = (value: string): string =>
  value.length > OUTPUT_LIMIT ? `${value.slice(0, OUTPUT_LIMIT)}\n… [truncated]` : value;

const filesFromProject = (project: GeneratedProject): Record<string, string> =>
  Object.fromEntries(
    Object.entries(project.files).map(([path, file]) => [path, file.code])
  );

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
  const provider = getWorkspaceProvider(workspace.runtime.provider);
  const loaded = await provider.loadWorkspace(workspace);
  const config = getRuntimeConfig();

  if (loaded.runtime.provider === "sandbox" && !config.gateway) {
    return withError(
      loaded,
      "Sandbox requires SANDBOX_GATEWAY_URL and SANDBOX_GATEWAY_SECRET (deploy workers/sandbox-gateway)."
    );
  }

  if (loaded.runtime.provider === "sandbox" && config.gateway) {
    try {
      const status = await sandboxGatewayStatus({ sandboxId: loaded.id });
      const procCount = Array.isArray(status.processes) ? status.processes.length : 0;
      const exposed = Array.isArray(status.exposed) ? status.exposed : [];
      const lines = [
        `Sandbox reachable. Processes: ${procCount}.`,
        exposed.length > 0
          ? `Exposed: ${exposed.map((p) => `${p.port}${p.url ? ` → ${p.url}` : ""}`).join("; ")}`
          : "No exposed ports yet.",
      ];

      return {
        workspace: {
          ...loaded,
          runtime: {
            ...loaded.runtime,
            status: loaded.runtime.status === "error" ? "error" : "ready",
            lastError: undefined,
            lastOutput: lines.join(" "),
            providerMeta: {
              ...(loaded.runtime.providerMeta ?? {}),
              mode: "sandbox-gateway",
            },
          },
        },
        output: lines.join("\n"),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sandbox status request failed.";
      return withError(loaded, message);
    }
  }

  return {
    workspace: {
      ...loaded,
      runtime: {
        ...loaded.runtime,
        status: "ready",
        lastError: undefined,
        lastOutput: "Virtual workspace is ready.",
        providerMeta: {
          ...(loaded.runtime.providerMeta ?? {}),
          mode: "virtual-ready",
        },
      },
    },
    output: "Virtual workspace is ready.",
  };
};

export const startPreview = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  if (workspace.runtime.provider === "virtual") {
    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "ready",
          lastError: undefined,
          lastOutput: "Virtual preview uses the built-in Sandpack experience.",
          preview: {
            status: "ready",
            url: "/studio",
          },
        },
      },
      output: "Virtual preview uses the built-in Sandpack experience.",
    };
  }

  const config = getRuntimeConfig();
  if (!config.gateway) {
    return withError(workspace, "Sandbox gateway is not configured.");
  }

  const rootPath = workspace.runtime.rootPath;
  const files = filesFromProject(workspace.project);

  try {
    await sandboxGatewaySyncProject({
      sandboxId: workspace.id,
      rootPath,
      files,
    });

    const install = await sandboxGatewayExec({
      sandboxId: workspace.id,
      command: "npm install",
      cwd: rootPath,
    });

    const installLog = truncateOutput(
      [install.stdout, install.stderr].filter(Boolean).join("\n")
    );

    if (!install.success) {
      return {
        workspace: {
          ...workspace,
          runtime: {
            ...workspace.runtime,
            status: "error",
            lastCommand: "npm install",
            lastOutput: installLog,
            lastError: `npm install exited with code ${install.exitCode}.`,
            preview: {
              status: "error",
              error: "npm install failed in sandbox.",
            },
          },
        },
        error: install.stderr || "npm install failed.",
        output: installLog,
      };
    }

    const started = await sandboxGatewayStartPreview({
      sandboxId: workspace.id,
      rootPath,
      port: 5173,
    });

    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "ready",
          lastCommand: "start_preview",
          lastError: undefined,
          lastOutput: truncateOutput(
            `npm install ok.\nDev server starting…\nPreview URL: ${started.previewUrl}`
          ),
          preview: {
            status: "ready",
            url: started.previewUrl,
          },
          providerMeta: {
            ...(workspace.runtime.providerMeta ?? {}),
            mode: "sandbox-gateway",
            previewProcessId: started.processId,
            previewPort: String(started.port),
          },
        },
      },
      output: `Preview ready at ${started.previewUrl}`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start sandbox preview.";
    return withError(workspace, message);
  }
};

export const stopPreview = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  if (workspace.runtime.provider === "virtual") {
    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          lastOutput: "Preview stopped.",
          lastError: undefined,
          preview: {
            status: "idle",
          },
        },
      },
      output: "Preview stopped.",
    };
  }

  const config = getRuntimeConfig();
  if (!config.gateway) {
    return withError(workspace, "Sandbox gateway is not configured.");
  }

  try {
    await sandboxGatewayStopPreview({ sandboxId: workspace.id });
    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "idle",
          lastOutput: "Sandbox preview stopped.",
          lastError: undefined,
          preview: {
            status: "idle",
            url: undefined,
            error: undefined,
          },
          providerMeta: {
            ...(workspace.runtime.providerMeta ?? {}),
            previewProcessId: "",
          },
        },
      },
      output: "Sandbox preview stopped.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stop sandbox preview.";
    return withError(workspace, message);
  }
};

export const runWorkspaceCommand = async (
  workspace: WorkspaceSnapshot,
  command: string
): Promise<RuntimeActionResult> => {
  const trimmed = command.trim();
  if (!trimmed) {
    return withError(workspace, "Command cannot be empty.");
  }

  if (workspace.runtime.provider === "virtual") {
    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "ready",
          lastCommand: trimmed,
          lastError: undefined,
          lastOutput: `Virtual mode cannot execute "${trimmed}". Use Cloudflare Sandbox (gateway) for commands.`,
        },
      },
      output: `Virtual mode cannot execute "${trimmed}".`,
    };
  }

  const config = getRuntimeConfig();
  if (!config.gateway) {
    return withError(workspace, "Sandbox gateway is not configured.");
  }

  const rootPath = workspace.runtime.rootPath;

  try {
    await sandboxGatewaySyncProject({
      sandboxId: workspace.id,
      rootPath,
      files: filesFromProject(workspace.project),
    });

    const result = await sandboxGatewayExec({
      sandboxId: workspace.id,
      command: trimmed,
      cwd: rootPath,
    });

    const combined = truncateOutput(
      [result.stdout, result.stderr].filter(Boolean).join("\n")
    );

    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: result.success ? "ready" : "error",
          lastCommand: trimmed,
          lastError: result.success
            ? undefined
            : `Exit code ${result.exitCode}`,
          lastOutput: combined || "(no output)",
          providerMeta: {
            ...(workspace.runtime.providerMeta ?? {}),
            mode: "sandbox-gateway",
          },
        },
      },
      output: combined || "(no output)",
      ...(result.success ? {} : { error: result.stderr || `Exit ${result.exitCode}` }),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sandbox command failed.";
    return withError(workspace, message);
  }
};

export const pushWorkspaceToSandbox = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  if (workspace.runtime.provider === "virtual") {
    return {
      workspace,
      output: "Virtual workspace — nothing to push to a remote sandbox.",
    };
  }

  const config = getRuntimeConfig();
  if (!config.gateway) {
    return withError(workspace, "Sandbox gateway is not configured.");
  }

  try {
    await sandboxGatewaySyncProject({
      sandboxId: workspace.id,
      rootPath: workspace.runtime.rootPath,
      files: filesFromProject(workspace.project),
    });

    return {
      workspace: {
        ...workspace,
        updatedAt: new Date().toISOString(),
        runtime: {
          ...workspace.runtime,
          status: "ready",
          lastCommand: "sync_workspace",
          lastError: undefined,
          lastOutput: "Workspace files pushed to sandbox.",
          providerMeta: {
            ...(workspace.runtime.providerMeta ?? {}),
            mode: "sandbox-gateway",
          },
        },
      },
      output: "Synced project files to Cloudflare Sandbox.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync workspace.";
    return withError(workspace, message);
  }
};

export const fetchSandboxProcessLogs = async (
  workspace: WorkspaceSnapshot,
  processId?: string
): Promise<RuntimeActionResult> => {
  if (workspace.runtime.provider === "virtual") {
    return {
      workspace,
      output: "No sandbox process logs in virtual mode.",
    };
  }

  const config = getRuntimeConfig();
  if (!config.gateway) {
    return withError(workspace, "Sandbox gateway is not configured.");
  }

  const pid =
    processId?.trim() ||
    workspace.runtime.providerMeta?.previewProcessId?.trim() ||
    "";

  if (!pid) {
    return {
      workspace,
      output:
        "No process id yet. Start a preview first, or pass previewProcessId in providerMeta.",
    };
  }

  try {
    const { logs } = await sandboxGatewayProcessLogs({
      sandboxId: workspace.id,
      processId: pid,
    });

    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          lastOutput: truncateOutput(logs),
          providerMeta: {
            ...(workspace.runtime.providerMeta ?? {}),
            lastLogProcessId: pid,
          },
        },
      },
      output: truncateOutput(logs),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch process logs.";
    return withError(workspace, message);
  }
};

export const verifyWorkspaceBuild = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> => {
  if (workspace.runtime.provider === "virtual") {
    return {
      workspace,
      output: "Build verification requires Cloudflare Sandbox gateway.",
    };
  }

  const config = getRuntimeConfig();
  if (!config.gateway) {
    return withError(workspace, "Sandbox gateway is not configured.");
  }

  const rootPath = workspace.runtime.rootPath;

  try {
    await sandboxGatewaySyncProject({
      sandboxId: workspace.id,
      rootPath,
      files: filesFromProject(workspace.project),
    });

    const result = await sandboxGatewayExec({
      sandboxId: workspace.id,
      command: "npm run build",
      cwd: rootPath,
    });

    const combined = truncateOutput(
      [result.stdout, result.stderr].filter(Boolean).join("\n")
    );

    return {
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: result.success ? "ready" : "error",
          lastCommand: "npm run build",
          lastError: result.success ? undefined : `Exit ${result.exitCode}`,
          lastOutput: combined || "(no output)",
          providerMeta: {
            ...(workspace.runtime.providerMeta ?? {}),
            mode: "sandbox-gateway",
            lastBuildOk: result.success ? "true" : "false",
          },
        },
      },
      output: combined || "(no output)",
      ...(result.success ? {} : { error: result.stderr || `Exit ${result.exitCode}` }),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Build verification failed.";
    return withError(workspace, message);
  }
};

export const installWorkspaceDependencies = async (
  workspace: WorkspaceSnapshot
): Promise<RuntimeActionResult> =>
  runWorkspaceCommand(workspace, "npm install");

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
      return stopPreview(workspace);
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
