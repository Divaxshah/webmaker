import { getSandbox, proxyToSandbox } from "@cloudflare/sandbox";

export { Sandbox } from "@cloudflare/sandbox";

interface Env {
  Sandbox: DurableObjectNamespace;
  GATEWAY_TOKEN?: string;
  SANDBOX_PREVIEW_HOSTNAME?: string;
  SANDBOX_SLEEP_AFTER?: string;
  SANDBOX_WORKSPACE_ROOT?: string;
  SANDBOX_PREVIEW_PORT?: string;
}

type RuntimeProvider = "local" | "virtual" | "cloudflare-sandbox";

interface GeneratedProject {
  title: string;
  summary: string;
  framework: "react-ts";
  entry: string;
  dependencies: Record<string, string>;
  files: Record<string, { code: string; hidden?: boolean; active?: boolean }>;
}

interface WorkspaceSnapshot {
  id: string;
  project: GeneratedProject;
  runtime: {
    provider: RuntimeProvider;
    status: "idle" | "provisioning" | "ready" | "error";
    rootPath: string;
    workspaceId: string;
    lastCommand?: string;
    lastOutput?: string;
    lastError?: string;
    lastProcessId?: string;
    providerLabel?: string;
    providerMeta?: Record<string, string>;
    preview: {
      status: "idle" | "starting" | "ready" | "error";
      url?: string;
      error?: string;
    };
  };
  updatedAt: string;
}

interface RuntimeIssue {
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

interface GatewayRequest {
  action:
    | "status"
    | "sync_workspace"
    | "install_dependencies"
    | "run_command"
    | "verify_build"
    | "start_preview"
    | "get_logs"
    | "stop_preview";
  workspace: WorkspaceSnapshot;
  command?: string;
  processId?: string;
  bootstrapFiles?: Record<string, string>;
}

interface GatewayResponse {
  ok: boolean;
  workspace: WorkspaceSnapshot;
  output?: string;
  error?: string;
  structuredErrors?: RuntimeIssue[];
  data?: unknown;
}

const ALLOWED_COMMANDS = new Set([
  "npm install",
  "npm run build",
  "npm run dev",
  "npm test",
  "npm run lint",
]);

const json = (body: GatewayResponse, status = 200): Response =>
  Response.json(body, { status });

const getWorkspaceRoot = (env: Env): string =>
  env.SANDBOX_WORKSPACE_ROOT?.trim() || "/workspace";

const getPreviewPort = (env: Env): number =>
  Number(env.SANDBOX_PREVIEW_PORT?.trim() || "5173");

const getPreviewHostname = (env: Env): string | null =>
  env.SANDBOX_PREVIEW_HOSTNAME?.trim() || null;

const buildRuntimeMeta = (
  workspace: WorkspaceSnapshot,
  extra?: Record<string, string>
): Record<string, string> => ({
  ...(workspace.runtime.providerMeta ?? {}),
  mode: "cloudflare-sandbox",
  sdkPackage: "@cloudflare/sandbox",
  ...extra,
});

const normalizePath = (inputPath: string): string =>
  `/${inputPath.replace(/^\/+/, "")}`;

const toContainerPath = (rootPath: string, projectPath: string): string => {
  const normalized = normalizePath(projectPath);
  return `${rootPath}/${normalized.replace(/^\//, "")}`;
};

const parseIssues = (
  output: string,
  fallbackType: RuntimeIssue["type"],
  command: string
): RuntimeIssue[] => {
  const issues: RuntimeIssue[] = [];
  const tsPattern =
    /([^:\s]+\.tsx?|[^:\s]+\.jsx?)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)/g;
  const missingPattern = /Cannot find (?:module|package) ['"]([^'"]+)['"]/g;

  for (const match of output.matchAll(tsPattern)) {
    issues.push({
      type: "typescript_error",
      file: normalizePath(match[1]),
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

  return [
    {
      type: fallbackType,
      message:
        output
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean) ?? "Command failed.",
      command,
      raw: output.slice(-4000),
    },
  ];
};

const withWorkspaceUpdate = (
  workspace: WorkspaceSnapshot,
  updates: Partial<WorkspaceSnapshot["runtime"]>,
  output?: string,
  error?: string
): WorkspaceSnapshot => ({
  ...workspace,
  runtime: {
    ...workspace.runtime,
    ...updates,
    provider: "cloudflare-sandbox",
    providerLabel: "Cloudflare Sandbox",
    lastOutput: output ?? updates.lastOutput ?? workspace.runtime.lastOutput,
    lastError: error ?? updates.lastError ?? workspace.runtime.lastError,
    providerMeta: buildRuntimeMeta(workspace, updates.providerMeta),
  },
  updatedAt: new Date().toISOString(),
});

const ensureAuthorized = (request: Request, env: Env): Response | null => {
  const expected = env.GATEWAY_TOKEN?.trim();
  if (!expected) return null;

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
};

const ensureWorkspaceOnSandbox = async (
  sandbox: ReturnType<typeof getSandbox>,
  env: Env,
  workspace: WorkspaceSnapshot,
  bootstrapFiles?: Record<string, string>
): Promise<void> => {
  const rootPath = getWorkspaceRoot(env);
  await sandbox.mkdir(rootPath, { recursive: true });

  for (const [filePath, code] of Object.entries(bootstrapFiles ?? {})) {
    const targetPath = toContainerPath(rootPath, filePath);
    const directory = targetPath.slice(0, targetPath.lastIndexOf("/"));
    if (directory) {
      await sandbox.mkdir(directory, { recursive: true });
    }
    await sandbox.writeFile(targetPath, code);
  }

  for (const [filePath, file] of Object.entries(workspace.project.files)) {
    const targetPath = toContainerPath(rootPath, filePath);
    const directory = targetPath.slice(0, targetPath.lastIndexOf("/"));
    if (directory) {
      await sandbox.mkdir(directory, { recursive: true });
    }
    await sandbox.writeFile(targetPath, file.code);
  }
};

const getSandboxInstance = (env: Env, workspace: WorkspaceSnapshot) =>
  getSandbox(env.Sandbox, workspace.runtime.workspaceId || workspace.id, {
    sleepAfter: env.SANDBOX_SLEEP_AFTER?.trim() || "10m",
    normalizeId: true,
  });

const handleStatus = async (
  env: Env,
  workspace: WorkspaceSnapshot
): Promise<GatewayResponse> => {
  const previewHostname = getPreviewHostname(env);
  return {
    ok: true,
    workspace: withWorkspaceUpdate(
      workspace,
      {
        status: "ready",
        rootPath: getWorkspaceRoot(env),
        providerMeta: {
          previewHostname: previewHostname ?? "unset",
        },
      },
      "Cloudflare Sandbox gateway reachable."
    ),
    output: "Cloudflare Sandbox gateway reachable.",
  };
};

const handleSync = async (
  env: Env,
  workspace: WorkspaceSnapshot,
  bootstrapFiles?: Record<string, string>
): Promise<GatewayResponse> => {
  const sandbox = getSandboxInstance(env, workspace);
  await ensureWorkspaceOnSandbox(sandbox, env, workspace, bootstrapFiles);
  const rootPath = getWorkspaceRoot(env);

  return {
    ok: true,
    workspace: withWorkspaceUpdate(
      workspace,
      {
        status: "ready",
        rootPath,
      },
      `Synced workspace to Cloudflare Sandbox at ${rootPath}.`
    ),
    output: `Synced workspace to Cloudflare Sandbox at ${rootPath}.`,
  };
};

const runCommand = async (
  env: Env,
  workspace: WorkspaceSnapshot,
  command: string,
  bootstrapFiles?: Record<string, string>
): Promise<GatewayResponse> => {
  if (!ALLOWED_COMMANDS.has(command)) {
    return {
      ok: false,
      workspace: withWorkspaceUpdate(workspace, { status: "error" }, undefined, "Command is not allowed."),
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

  const sandbox = getSandboxInstance(env, workspace);
  await ensureWorkspaceOnSandbox(sandbox, env, workspace, bootstrapFiles);
  const result = await sandbox.exec(command, {
    cwd: getWorkspaceRoot(env),
    timeout: command === "npm install" ? 180000 : 120000,
    env: {
      CI: "1",
      BROWSER: "none",
    },
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const ok = result.success;
  const error = ok ? undefined : `Command exited with code ${result.exitCode}.`;

  return {
    ok,
    workspace: withWorkspaceUpdate(
      workspace,
      {
        status: ok ? "ready" : "error",
        rootPath: getWorkspaceRoot(env),
        lastCommand: command,
      },
      output,
      error
    ),
    output,
    error,
    structuredErrors: ok
      ? []
      : parseIssues(
          output,
          command === "npm install" ? "install_error" : "build_error",
          command
        ),
  };
};

const handlePreviewStart = async (
  request: Request,
  env: Env,
  workspace: WorkspaceSnapshot,
  bootstrapFiles?: Record<string, string>
): Promise<GatewayResponse> => {
  const previewHostname = getPreviewHostname(env);
  if (!previewHostname) {
    const message =
      "SANDBOX_PREVIEW_HOSTNAME is not set on the worker. Configure a custom domain with wildcard DNS before using Cloudflare preview URLs.";
    return {
      ok: false,
      workspace: withWorkspaceUpdate(
        workspace,
        {
          status: "error",
          preview: {
            status: "error",
            error: message,
          },
        },
        undefined,
        message
      ),
      error: message,
    };
  }

  const sandbox = getSandboxInstance(env, workspace);
  await ensureWorkspaceOnSandbox(sandbox, env, workspace, bootstrapFiles);
  const port = getPreviewPort(env);
  const processId = `${workspace.id}-preview`;
  const server = await sandbox.startProcess("npm run dev -- --host 0.0.0.0 --port 5173", {
    cwd: getWorkspaceRoot(env),
    env: {
      BROWSER: "none",
      PORT: String(port),
    },
    processId,
    autoCleanup: false,
  });

  await server.waitForPort(port, { timeout: 120000, mode: "http" });
  const exposed = await sandbox.exposePort(port, {
    hostname: previewHostname,
    token: workspace.id.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16) || "webmaker",
    name: "preview",
  });

  return {
    ok: true,
    workspace: withWorkspaceUpdate(
      workspace,
      {
        status: "ready",
        lastCommand: "npm run dev",
        lastProcessId: server.id,
        preview: {
          status: "ready",
          url: exposed.url,
        },
        providerMeta: {
          previewHostname,
          previewPort: String(port),
          previewProcessId: server.id,
          workerHostname: new URL(request.url).hostname,
        },
      },
      `Preview started at ${exposed.url}.`
    ),
    output: `Preview started at ${exposed.url}.`,
    data: {
      processId: server.id,
      url: exposed.url,
    },
  };
};

const handleGetLogs = async (
  env: Env,
  workspace: WorkspaceSnapshot,
  processId?: string
): Promise<GatewayResponse> => {
  const sandbox = getSandboxInstance(env, workspace);
  const targetProcessId =
    processId ??
    workspace.runtime.providerMeta?.previewProcessId ??
    workspace.runtime.lastProcessId;

  if (!targetProcessId) {
    return {
      ok: true,
      workspace: withWorkspaceUpdate(workspace, {}, "No process logs available."),
      output: "No process logs available.",
    };
  }

  const logs = await sandbox.getProcessLogs(targetProcessId);
  return {
    ok: true,
    workspace: withWorkspaceUpdate(
      workspace,
      {
        lastProcessId: targetProcessId,
      },
      logs
    ),
    output: logs,
  };
};

const handleStopPreview = async (
  env: Env,
  workspace: WorkspaceSnapshot,
  processId?: string
): Promise<GatewayResponse> => {
  const sandbox = getSandboxInstance(env, workspace);
  const targetProcessId =
    processId ??
    workspace.runtime.providerMeta?.previewProcessId ??
    workspace.runtime.lastProcessId;

  if (targetProcessId) {
    await sandbox.killProcess(targetProcessId);
  }

  const port = Number(workspace.runtime.providerMeta?.previewPort || getPreviewPort(env));
  await sandbox.unexposePort(port).catch(() => undefined);

  return {
    ok: true,
    workspace: withWorkspaceUpdate(
      workspace,
      {
        lastProcessId: undefined,
        preview: {
          status: "idle",
        },
      },
      targetProcessId
        ? `Stopped preview ${targetProcessId}.`
        : "No preview process was running."
    ),
    output: targetProcessId
      ? `Stopped preview ${targetProcessId}.`
      : "No preview process was running.",
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const proxied = await proxyToSandbox(request, env);
    if (proxied) {
      return proxied;
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "webmaker-sandbox-gateway",
        previewHostname: getPreviewHostname(env),
      });
    }

    if (request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const authError = ensureAuthorized(request, env);
    if (authError) {
      return authError;
    }

    try {
      const body = (await request.json()) as GatewayRequest;
      const { workspace, action, command, processId, bootstrapFiles } = body;
      if (!workspace || typeof workspace.id !== "string") {
        return json(
          {
            ok: false,
            workspace: workspace as WorkspaceSnapshot,
            error: "Invalid workspace payload.",
          },
          400
        );
      }

      let result: GatewayResponse;
      switch (action) {
        case "status":
          result = await handleStatus(env, workspace);
          break;
        case "sync_workspace":
          result = await handleSync(env, workspace, bootstrapFiles);
          break;
        case "install_dependencies":
          result = await runCommand(env, workspace, "npm install", bootstrapFiles);
          break;
        case "run_command":
          result = await runCommand(env, workspace, command ?? "", bootstrapFiles);
          break;
        case "verify_build":
          result = await runCommand(env, workspace, "npm run build", bootstrapFiles);
          break;
        case "start_preview":
          result = await handlePreviewStart(request, env, workspace, bootstrapFiles);
          break;
        case "get_logs":
          result = await handleGetLogs(env, workspace, processId);
          break;
        case "stop_preview":
          result = await handleStopPreview(env, workspace, processId);
          break;
        default:
          result = {
            ok: false,
            workspace,
            error: `Unsupported action: ${String(action)}`,
          };
      }

      return json(result, result.ok ? 200 : 400);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected gateway error.";
      return Response.json(
        {
          ok: false,
          error: message,
        },
        { status: 500 }
      );
    }
  },
};
