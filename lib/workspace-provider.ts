import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";
import { getRuntimeConfig, hasSandboxGateway } from "@/lib/runtime-config";
import {
  createWorkspaceSnapshot,
  readWorkspaceFiles,
  syncProjectToWorkspace,
  writeWorkspaceFiles,
} from "@/lib/workspace";

export interface WorkspaceProvider {
  readonly name: "virtual" | "sandbox";
  createWorkspace(project?: GeneratedProject, workspaceId?: string): Promise<WorkspaceSnapshot>;
  loadWorkspace(workspace: WorkspaceSnapshot): Promise<WorkspaceSnapshot>;
  saveWorkspace(workspace: WorkspaceSnapshot, project: GeneratedProject): Promise<WorkspaceSnapshot>;
  readFiles(
    workspace: WorkspaceSnapshot,
    paths: string[]
  ): Promise<{ files: Record<string, string>; missing: string[] }>;
  writeFiles(
    workspace: WorkspaceSnapshot,
    writes: Array<[string, { code: string; hidden?: boolean; active?: boolean }]>
  ): Promise<WorkspaceSnapshot>;
}

class VirtualWorkspaceProvider implements WorkspaceProvider {
  readonly name = "virtual" as const;

  async createWorkspace(
    project?: GeneratedProject,
    workspaceId?: string
  ): Promise<WorkspaceSnapshot> {
    const workspace = createWorkspaceSnapshot(project, workspaceId);
    return {
      ...workspace,
      runtime: {
        ...workspace.runtime,
        provider: "virtual",
        providerLabel: "Virtual Workspace",
        providerMeta: {
          mode: "in-memory",
        },
      },
    };
  }

  async loadWorkspace(workspace: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    return workspace;
  }

  async saveWorkspace(
    workspace: WorkspaceSnapshot,
    project: GeneratedProject
  ): Promise<WorkspaceSnapshot> {
    return syncProjectToWorkspace(workspace, project);
  }

  async readFiles(
    workspace: WorkspaceSnapshot,
    paths: string[]
  ): Promise<{ files: Record<string, string>; missing: string[] }> {
    return readWorkspaceFiles(workspace, paths);
  }

  async writeFiles(
    workspace: WorkspaceSnapshot,
    writes: Array<[string, { code: string; hidden?: boolean; active?: boolean }]>
  ): Promise<WorkspaceSnapshot> {
    return writeWorkspaceFiles(workspace, writes).workspace;
  }
}

const virtualProvider = new VirtualWorkspaceProvider();

class CloudflareSandboxProvider implements WorkspaceProvider {
  readonly name = "sandbox" as const;

  async createWorkspace(
    project?: GeneratedProject,
    workspaceId?: string
  ): Promise<WorkspaceSnapshot> {
    const config = getRuntimeConfig();
    const workspace = createWorkspaceSnapshot(project, workspaceId);

    return {
      ...workspace,
      runtime: {
        ...workspace.runtime,
        provider: "sandbox",
        status: config.gateway ? "provisioning" : "error",
        rootPath: config.cloudflare?.defaultRootPath ?? workspace.runtime.rootPath,
        providerLabel: "Cloudflare Sandbox",
        providerMeta: config.gateway
          ? {
              mode: "gateway",
              gatewayUrl: config.gateway.baseUrl,
              ...(config.cloudflare?.workerName
                ? { worker: config.cloudflare.workerName }
                : {}),
            }
          : {
              error:
                "Missing SANDBOX_GATEWAY_URL / SANDBOX_GATEWAY_SECRET (deploy workers/sandbox-gateway).",
            },
        preview: {
          ...workspace.runtime.preview,
          status: "idle",
        },
      },
    };
  }

  async loadWorkspace(workspace: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    const config = getRuntimeConfig();
    return {
      ...workspace,
      runtime: {
        ...workspace.runtime,
        provider: "sandbox",
        status: config.gateway ? workspace.runtime.status : "error",
        providerLabel: "Cloudflare Sandbox",
        providerMeta: config.gateway
          ? {
              mode: "gateway",
              gatewayUrl: config.gateway.baseUrl,
              ...(config.cloudflare?.workerName
                ? { worker: config.cloudflare.workerName }
                : {}),
            }
          : {
              error:
                "Missing SANDBOX_GATEWAY_URL / SANDBOX_GATEWAY_SECRET (deploy workers/sandbox-gateway).",
            },
      },
    };
  }

  async saveWorkspace(
    workspace: WorkspaceSnapshot,
    project: GeneratedProject
  ): Promise<WorkspaceSnapshot> {
    return syncProjectToWorkspace(workspace, project);
  }

  async readFiles(
    workspace: WorkspaceSnapshot,
    paths: string[]
  ): Promise<{ files: Record<string, string>; missing: string[] }> {
    return readWorkspaceFiles(workspace, paths);
  }

  async writeFiles(
    workspace: WorkspaceSnapshot,
    writes: Array<[string, { code: string; hidden?: boolean; active?: boolean }]>
  ): Promise<WorkspaceSnapshot> {
    return writeWorkspaceFiles(workspace, writes).workspace;
  }
}

const cloudflareProvider = new CloudflareSandboxProvider();

export const getWorkspaceProvider = (
  providerName: WorkspaceSnapshot["runtime"]["provider"] = "virtual"
): WorkspaceProvider => {
  if (providerName === "virtual") {
    return virtualProvider;
  }

  return cloudflareProvider;
};

export const resolvePreferredWorkspaceProvider = (): WorkspaceProvider =>
  hasSandboxGateway() ? cloudflareProvider : virtualProvider;
