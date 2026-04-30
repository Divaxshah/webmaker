import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { getBootstrapFiles } from "@/lib/download-bootstrap";
import { callCloudflareSandboxGateway } from "@/lib/cloudflare-sandbox-gateway";
import { normalizeProjectPath } from "@/lib/project";
import { getRuntimeProviderLabel, getRuntimeConfig, type RuntimeProviderMode } from "@/lib/runtime-config";
import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";
import {
  createWorkspaceSnapshot,
  DEFAULT_WORKSPACE_ROOT,
  readWorkspaceFiles,
  syncProjectToWorkspace,
  writeWorkspaceFiles,
} from "@/lib/workspace";

export interface RuntimeIssue {
  type:
    | "install_error"
    | "missing_dependency"
    | "typescript_error"
    | "vite_error"
    | "build_error"
    | "runtime_error"
    | "console_error"
    | "process_error";
  message: string;
  file?: string;
  line?: number;
  column?: number;
  command?: string;
  packageName?: string;
  raw?: string;
}

export interface RuntimeResult<T = unknown> {
  ok: boolean;
  workspace: WorkspaceSnapshot;
  data?: T;
  output?: string;
  error?: string;
  structuredErrors?: RuntimeIssue[];
}

export interface WorkspaceProvider {
  readonly name: WorkspaceSnapshot["runtime"]["provider"];
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
  syncWorkspace?(workspace: WorkspaceSnapshot): Promise<RuntimeResult>;
  installDependencies?(workspace: WorkspaceSnapshot): Promise<RuntimeResult>;
  runCommand?(workspace: WorkspaceSnapshot, command: string): Promise<RuntimeResult>;
  startPreview?(workspace: WorkspaceSnapshot): Promise<RuntimeResult<{ processId: string; url: string }>>;
  stopPreview?(workspace: WorkspaceSnapshot, processId?: string): Promise<RuntimeResult>;
  getLogs?(workspace: WorkspaceSnapshot, processId?: string): Promise<RuntimeResult>;
  verifyBuild?(workspace: WorkspaceSnapshot): Promise<RuntimeResult>;
}

const WORKSPACE_ROOT = path.join(process.cwd(), ".webmaker", "workspaces");
const COMMAND_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 80_000;

interface ManagedProcess {
  process: ChildProcessWithoutNullStreams;
  logs: string;
  command: string;
}

const managedProcesses = new Map<string, ManagedProcess>();

const appendOutput = (current: string, chunk: string): string =>
  `${current}${chunk}`.slice(-MAX_OUTPUT_CHARS);

const toRelativeDiskPath = (projectPath: string): string => {
  const normalized = normalizeProjectPath(projectPath).replace(/^\/+/, "");
  const resolved = path.normalize(normalized);

  if (resolved.startsWith("..") || path.isAbsolute(resolved)) {
    throw new Error(`Unsafe project path: ${projectPath}`);
  }

  return resolved;
};

const getLocalWorkspaceRoot = (workspaceId: string): string =>
  path.join(WORKSPACE_ROOT, workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_"));

/** Snapshots use `/workspace` like the sandbox; on the host that path is usually not writable. */
const resolveLocalDiskRoot = (workspace: WorkspaceSnapshot): string => {
  const root = workspace.runtime.rootPath?.trim() ?? "";
  if (!root || root === DEFAULT_WORKSPACE_ROOT) {
    return getLocalWorkspaceRoot(workspace.id);
  }
  return root;
};

const writeProjectToDisk = async (
  rootPath: string,
  project: GeneratedProject
): Promise<void> => {
  await mkdir(rootPath, { recursive: true });

  const bootstrapFiles = getBootstrapFiles(project);
  for (const [filePath, code] of Object.entries(bootstrapFiles)) {
    const diskPath = path.join(rootPath, toRelativeDiskPath(filePath));
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, code, "utf8");
  }

  for (const [filePath, file] of Object.entries(project.files)) {
    const diskPath = path.join(rootPath, toRelativeDiskPath(filePath));
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, file.code, "utf8");
  }
};

const commandToArgs = (command: string): string[] | null => {
  const normalized = command.trim().replace(/\s+/g, " ");
  const allowed: Record<string, string[]> = {
    "npm install": ["install"],
    "npm run build": ["run", "build"],
    "npm run dev": ["run", "dev"],
    "npm test": ["test"],
    "npm run lint": ["run", "lint"],
  };

  return allowed[normalized] ?? null;
};

const parseIssues = (
  output: string,
  fallbackType: RuntimeIssue["type"],
  command: string
): RuntimeIssue[] => {
  const issues: RuntimeIssue[] = [];
  const tsPattern = /([^:\s]+\.tsx?|[^:\s]+\.jsx?)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)/g;
  const missingPattern = /Cannot find (?:module|package) ['"]([^'"]+)['"]/g;

  for (const match of output.matchAll(tsPattern)) {
    issues.push({
      type: "typescript_error",
      file: normalizeProjectPath(match[1]),
      line: Number(match[2]),
      column: Number(match[3]),
      message: match[4],
      command,
      raw: match[0],
    });
  }

  for (const match of output.matchAll(missingPattern)) {
    issues.push({
      type: "missing_dependency",
      packageName: match[1],
      message: `Missing dependency or module: ${match[1]}`,
      command,
      raw: match[0],
    });
  }

  if (issues.length > 0) {
    return issues.slice(0, 20);
  }

  const firstMeaningfulLine =
    output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "Command failed.";

  return [
    {
      type: fallbackType,
      message: firstMeaningfulLine,
      command,
      raw: output.slice(-4000),
    },
  ];
};

const runNpmCommand = async (
  workspace: WorkspaceSnapshot,
  command: string,
  timeoutMs = COMMAND_TIMEOUT_MS
): Promise<RuntimeResult> => {
  const args = commandToArgs(command);
  if (!args) {
    return {
      ok: false,
      workspace: {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "error",
          lastCommand: command,
          lastError: "Command is not allowed.",
        },
      },
      error: "Command is not allowed.",
      structuredErrors: [
        {
          type: "process_error",
          message: "Command is not allowed.",
          command,
        },
      ],
    };
  }

  await writeProjectToDisk(workspace.runtime.rootPath, workspace.project);

  return new Promise((resolve) => {
    const child = spawn("npm", args, {
      cwd: workspace.runtime.rootPath,
      env: {
        ...process.env,
        CI: "1",
        BROWSER: "none",
      },
    });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      output = appendOutput(output, `\nCommand timed out after ${timeoutMs}ms.`);
      const nextWorkspace = {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "error" as const,
          lastCommand: command,
          lastOutput: output,
          lastError: "Command timed out.",
        },
        updatedAt: new Date().toISOString(),
      };
      resolve({
        ok: false,
        workspace: nextWorkspace,
        output,
        error: "Command timed out.",
        structuredErrors: parseIssues(output, "process_error", command),
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output = appendOutput(output, chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      output = appendOutput(output, chunk.toString());
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const ok = code === 0;
      const nextWorkspace = {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: ok ? ("ready" as const) : ("error" as const),
          lastCommand: command,
          lastOutput: output,
          lastError: ok ? undefined : `Command exited with code ${code ?? "unknown"}.`,
        },
        updatedAt: new Date().toISOString(),
      };
      resolve({
        ok,
        workspace: nextWorkspace,
        output,
        error: ok ? undefined : nextWorkspace.runtime.lastError,
        structuredErrors: ok
          ? []
          : parseIssues(
              output,
              command === "npm install" ? "install_error" : "build_error",
              command
            ),
      });
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const nextWorkspace = {
        ...workspace,
        runtime: {
          ...workspace.runtime,
          status: "error" as const,
          lastCommand: command,
          lastOutput: output,
          lastError: error.message,
        },
        updatedAt: new Date().toISOString(),
      };
      resolve({
        ok: false,
        workspace: nextWorkspace,
        output,
        error: error.message,
        structuredErrors: [
          {
            type: "process_error",
            message: error.message,
            command,
          },
        ],
      });
    });
  });
};

const findAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Unable to allocate a local preview port."));
        }
      });
    });
    server.on("error", reject);
  });

class LocalWorkspaceProvider implements WorkspaceProvider {
  readonly name = "local" as const;

  async createWorkspace(
    project?: GeneratedProject,
    workspaceId?: string
  ): Promise<WorkspaceSnapshot> {
    const workspace = createWorkspaceSnapshot(project, workspaceId);
    const rootPath = getLocalWorkspaceRoot(workspace.id);
    const nextWorkspace: WorkspaceSnapshot = {
      ...workspace,
      runtime: {
        ...workspace.runtime,
        provider: "local",
        providerLabel: "Local Runtime",
        rootPath,
        status: "ready",
        providerMeta: {
          mode: "local",
        },
      },
    };
    await writeProjectToDisk(rootPath, nextWorkspace.project);
    return nextWorkspace;
  }

  async loadWorkspace(workspace: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    const rootPath =
      workspace.runtime.provider === "local"
        ? resolveLocalDiskRoot(workspace)
        : getLocalWorkspaceRoot(workspace.id);
    const nextWorkspace: WorkspaceSnapshot = {
      ...workspace,
      runtime: {
        ...workspace.runtime,
        provider: "local",
        providerLabel: "Local Runtime",
        rootPath,
        status: workspace.runtime.status === "idle" ? "ready" : workspace.runtime.status,
        providerMeta: {
          ...(workspace.runtime.providerMeta ?? {}),
          mode: "local",
        },
      },
    };
    await writeProjectToDisk(rootPath, nextWorkspace.project);
    return nextWorkspace;
  }

  async saveWorkspace(
    workspace: WorkspaceSnapshot,
    project: GeneratedProject
  ): Promise<WorkspaceSnapshot> {
    const nextWorkspace = syncProjectToWorkspace(await this.loadWorkspace(workspace), project);
    await writeProjectToDisk(nextWorkspace.runtime.rootPath, nextWorkspace.project);
    return nextWorkspace;
  }

  async readFiles(
    workspace: WorkspaceSnapshot,
    paths: string[]
  ): Promise<{ files: Record<string, string>; missing: string[] }> {
    const loaded = await this.loadWorkspace(workspace);
    const files: Record<string, string> = {};
    const missing: string[] = [];

    for (const filePath of paths) {
      const normalizedPath = normalizeProjectPath(filePath);
      try {
        files[normalizedPath] = await readFile(
          path.join(loaded.runtime.rootPath, toRelativeDiskPath(normalizedPath)),
          "utf8"
        );
      } catch {
        missing.push(normalizedPath);
      }
    }

    return { files, missing };
  }

  async writeFiles(
    workspace: WorkspaceSnapshot,
    writes: Array<[string, { code: string; hidden?: boolean; active?: boolean }]>
  ): Promise<WorkspaceSnapshot> {
    const nextWorkspace = writeWorkspaceFiles(await this.loadWorkspace(workspace), writes).workspace;
    await writeProjectToDisk(nextWorkspace.runtime.rootPath, nextWorkspace.project);
    return nextWorkspace;
  }

  async syncWorkspace(workspace: WorkspaceSnapshot): Promise<RuntimeResult> {
    const loaded = await this.loadWorkspace(workspace);
    await writeProjectToDisk(loaded.runtime.rootPath, loaded.project);
    return {
      ok: true,
      workspace: {
        ...loaded,
        updatedAt: new Date().toISOString(),
      },
      output: `Synced workspace to ${loaded.runtime.rootPath}.`,
    };
  }

  async installDependencies(workspace: WorkspaceSnapshot): Promise<RuntimeResult> {
    return runNpmCommand(await this.loadWorkspace(workspace), "npm install", 180_000);
  }

  async runCommand(workspace: WorkspaceSnapshot, command: string): Promise<RuntimeResult> {
    return runNpmCommand(await this.loadWorkspace(workspace), command);
  }

  async verifyBuild(workspace: WorkspaceSnapshot): Promise<RuntimeResult> {
    return runNpmCommand(await this.loadWorkspace(workspace), "npm run build");
  }

  async startPreview(
    workspace: WorkspaceSnapshot
  ): Promise<RuntimeResult<{ processId: string; url: string }>> {
    const loaded = await this.loadWorkspace(workspace);
    await writeProjectToDisk(loaded.runtime.rootPath, loaded.project);

    const port = await findAvailablePort();
    const processId = `${loaded.id}-preview`;
    const existing = managedProcesses.get(processId);
    if (existing) {
      existing.process.kill("SIGTERM");
      managedProcesses.delete(processId);
    }

    const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: loaded.runtime.rootPath,
      env: {
        ...process.env,
        BROWSER: "none",
      },
    });
    const managed: ManagedProcess = {
      process: child,
      logs: "",
      command: "npm run dev",
    };
    managedProcesses.set(processId, managed);

    child.stdout.on("data", (chunk) => {
      managed.logs = appendOutput(managed.logs, chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      managed.logs = appendOutput(managed.logs, chunk.toString());
    });
    child.on("close", (code) => {
      managed.logs = appendOutput(managed.logs, `\nPreview process exited with code ${code ?? "unknown"}.`);
    });
    child.on("error", (error) => {
      managed.logs = appendOutput(managed.logs, `\nPreview process error: ${error.message}`);
    });

    const url = `http://127.0.0.1:${port}`;
    const nextWorkspace: WorkspaceSnapshot = {
      ...loaded,
      runtime: {
        ...loaded.runtime,
        status: "ready",
        lastCommand: "npm run dev",
        lastError: undefined,
        lastProcessId: processId,
        providerMeta: {
          ...(loaded.runtime.providerMeta ?? {}),
          previewProcessId: processId,
          previewPort: String(port),
        },
        preview: {
          status: "ready",
          url,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    return {
      ok: true,
      workspace: nextWorkspace,
      data: { processId, url },
      output: `Preview started at ${url}.`,
    };
  }

  async stopPreview(workspace: WorkspaceSnapshot, processId?: string): Promise<RuntimeResult> {
    const loaded = await this.loadWorkspace(workspace);
    const targetProcessId =
      processId ??
      loaded.runtime.providerMeta?.previewProcessId ??
      loaded.runtime.lastProcessId;
    if (targetProcessId) {
      const managed = managedProcesses.get(targetProcessId);
      if (managed) {
        managed.process.kill("SIGTERM");
        managedProcesses.delete(targetProcessId);
      }
    }

    return {
      ok: true,
      workspace: {
        ...loaded,
        runtime: {
          ...loaded.runtime,
          lastProcessId: undefined,
          preview: {
            status: "idle",
          },
        },
        updatedAt: new Date().toISOString(),
      },
      output: targetProcessId ? `Stopped preview ${targetProcessId}.` : "No preview process was running.",
    };
  }

  async getLogs(workspace: WorkspaceSnapshot, processId?: string): Promise<RuntimeResult> {
    const loaded = await this.loadWorkspace(workspace);
    const targetProcessId =
      processId ??
      loaded.runtime.providerMeta?.previewProcessId ??
      loaded.runtime.lastProcessId;
    const managed = targetProcessId ? managedProcesses.get(targetProcessId) : undefined;
    const output = managed?.logs ?? loaded.runtime.lastOutput ?? "No local process logs.";

    return {
      ok: true,
      workspace: {
        ...loaded,
        runtime: {
          ...loaded.runtime,
          lastOutput: output,
        },
        updatedAt: new Date().toISOString(),
      },
      output,
    };
  }
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

class CloudflareSandboxWorkspaceProvider implements WorkspaceProvider {
  readonly name = "cloudflare-sandbox" as const;

  private hydrate(workspace: WorkspaceSnapshot): WorkspaceSnapshot {
    return {
      ...workspace,
      runtime: {
        ...workspace.runtime,
        provider: "cloudflare-sandbox",
        providerLabel: getRuntimeProviderLabel("cloudflare-sandbox"),
        status: workspace.runtime.status === "idle" ? "ready" : workspace.runtime.status,
        providerMeta: {
          ...(workspace.runtime.providerMeta ?? {}),
          mode: "cloudflare-sandbox",
          sdkPackage: "@cloudflare/sandbox",
          commandMethod: "sandbox.exec(command, options?)",
          processMethod: "sandbox.startProcess(command, options?)",
          logsMethod: "sandbox.getProcessLogs(processId)",
          previewMethod: "process.waitForPort(port) + sandbox.getPreviewLink(port)",
        },
      },
    };
  }

  async createWorkspace(
    project?: GeneratedProject,
    workspaceId?: string
  ): Promise<WorkspaceSnapshot> {
    return this.hydrate(createWorkspaceSnapshot(project, workspaceId));
  }

  async loadWorkspace(workspace: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    const result = await callCloudflareSandboxGateway("status", this.hydrate(workspace));
    return result.workspace;
  }

  async saveWorkspace(
    workspace: WorkspaceSnapshot,
    project: GeneratedProject
  ): Promise<WorkspaceSnapshot> {
    return syncProjectToWorkspace(this.hydrate(workspace), project);
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
    return writeWorkspaceFiles(this.hydrate(workspace), writes).workspace;
  }

  async syncWorkspace(workspace: WorkspaceSnapshot): Promise<RuntimeResult> {
    return callCloudflareSandboxGateway(
      "sync_workspace",
      this.hydrate(workspace)
    );
  }

  async installDependencies(workspace: WorkspaceSnapshot): Promise<RuntimeResult> {
    return callCloudflareSandboxGateway(
      "install_dependencies",
      this.hydrate(workspace)
    );
  }

  async runCommand(workspace: WorkspaceSnapshot, command: string): Promise<RuntimeResult> {
    return callCloudflareSandboxGateway("run_command", this.hydrate(workspace), {
      command,
    });
  }

  async verifyBuild(workspace: WorkspaceSnapshot): Promise<RuntimeResult> {
    return this.runCommand(workspace, "npm run build");
  }

  async startPreview(
    workspace: WorkspaceSnapshot
  ): Promise<RuntimeResult<{ processId: string; url: string }>> {
    return callCloudflareSandboxGateway(
      "start_preview",
      this.hydrate(workspace)
    ) as Promise<RuntimeResult<{ processId: string; url: string }>>;
  }

  async stopPreview(workspace: WorkspaceSnapshot, processId?: string): Promise<RuntimeResult> {
    return callCloudflareSandboxGateway("stop_preview", this.hydrate(workspace), {
      processId,
    });
  }

  async getLogs(workspace: WorkspaceSnapshot, processId?: string): Promise<RuntimeResult> {
    return callCloudflareSandboxGateway("get_logs", this.hydrate(workspace), {
      processId,
    });
  }
}

const virtualProvider = new VirtualWorkspaceProvider();
const localProvider = new LocalWorkspaceProvider();
const cloudflareSandboxProvider = new CloudflareSandboxWorkspaceProvider();

const resolveProviderMode = (workspace?: WorkspaceSnapshot): RuntimeProviderMode => {
  if (workspace?.runtime.provider) {
    return workspace.runtime.provider;
  }

  return getRuntimeConfig().mode;
};

export const getWorkspaceProvider = (
  workspace?: WorkspaceSnapshot
): WorkspaceProvider => {
  const mode = resolveProviderMode(workspace);

  switch (mode) {
    case "virtual":
      return virtualProvider;
    case "cloudflare-sandbox":
      return cloudflareSandboxProvider;
    case "local":
    default:
      return localProvider;
  }
};
