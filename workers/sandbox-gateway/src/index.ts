import { getSandbox, proxyToSandbox, Sandbox } from "@cloudflare/sandbox";

export { Sandbox };

type SandboxClient = ReturnType<typeof getSandbox>;

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
  SANDBOX_API_SECRET: string;
  SANDBOX_PREVIEW_HOSTNAME: string;
}

const corsHeaders = (): HeadersInit => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const proxyResponse = await proxyToSandbox(request, env as never);
    if (proxyResponse) {
      return proxyResponse;
    }

    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST" || !url.pathname.startsWith("/v1/")) {
      return textResponse(
        "Webmaker Sandbox Gateway — use POST /v1/sync | /v1/exec | /v1/start-preview | /v1/stop-preview | /v1/status | /v1/process-logs",
        404
      );
    }

    const auth = request.headers.get("Authorization") ?? "";
    if (!env.SANDBOX_API_SECRET || auth !== `Bearer ${env.SANDBOX_API_SECRET}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const sandboxId = typeof body.sandboxId === "string" ? body.sandboxId.trim() : "";
    if (!sandboxId) {
      return json({ error: "sandboxId is required" }, 400);
    }

    const sandbox = getSandbox(env.Sandbox, sandboxId);

    try {
      switch (url.pathname) {
        case "/v1/sync":
          return await routeSync(sandbox, body);
        case "/v1/exec":
          return await routeExec(sandbox, body);
        case "/v1/start-preview":
          return await routeStartPreview(sandbox, body, env);
        case "/v1/stop-preview":
          return await routeStopPreview(sandbox, env);
        case "/v1/status":
          return await routeStatus(sandbox, env);
        case "/v1/process-logs":
          return await routeProcessLogs(sandbox, body);
        default:
          return json({ error: "Unknown route" }, 404);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sandbox error";
      return json({ error: message }, 500);
    }
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function clearExposedPorts(sandbox: SandboxClient, hostname: string): Promise<void> {
  const list = await sandbox.getExposedPorts(hostname);
  for (const entry of list) {
    await sandbox.unexposePort(entry.port);
  }
}

async function routeSync(sandbox: SandboxClient, body: Record<string, unknown>): Promise<Response> {
  const rootPath =
    typeof body.rootPath === "string" && body.rootPath.startsWith("/")
      ? body.rootPath
      : "/workspace";
  const files = body.files;
  if (!files || typeof files !== "object") {
    return json({ error: "files map is required" }, 400);
  }

  const entries = Object.entries(files as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  for (const [path, content] of entries) {
    const abs = joinAbsolute(rootPath, path);
    const parent = posixDirname(abs);
    if (parent.length > 0) {
      await sandbox.mkdir(parent, { recursive: true });
    }
    await sandbox.writeFile(abs, content);
  }

  return json({ ok: true, written: entries.length });
}

async function routeExec(sandbox: SandboxClient, body: Record<string, unknown>): Promise<Response> {
  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) {
    return json({ error: "command is required" }, 400);
  }
  const cwd =
    typeof body.cwd === "string" && body.cwd.startsWith("/") ? body.cwd : undefined;

  const result = await sandbox.exec(command, cwd ? { cwd } : {});

  return json({
    success: result.success,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exitCode,
  });
}

async function routeStartPreview(
  sandbox: SandboxClient,
  body: Record<string, unknown>,
  env: Env
): Promise<Response> {
  const rootPath =
    typeof body.rootPath === "string" && body.rootPath.startsWith("/")
      ? body.rootPath
      : "/workspace";
  const portRaw = body.port;
  const port =
    typeof portRaw === "number" && portRaw > 0
      ? Math.floor(portRaw)
      : typeof portRaw === "string" && /^\d+$/.test(portRaw)
        ? Number(portRaw)
        : 5173;
  const command =
    typeof body.command === "string" && body.command.trim().length > 0
      ? body.command.trim()
      : `npm run dev -- --host 0.0.0.0 --port ${String(port)}`;

  const hostname = env.SANDBOX_PREVIEW_HOSTNAME?.trim();
  if (!hostname || hostname === "localhost") {
    return json(
      {
        error:
          "Set SANDBOX_PREVIEW_HOSTNAME on the Worker to a hostname with wildcard DNS (exposePort cannot use localhost).",
      },
      400
    );
  }

  await sandbox.killAllProcesses();
  await clearExposedPorts(sandbox, hostname);

  await sandbox.setKeepAlive(true);

  const proc = await sandbox.startProcess(command, { cwd: rootPath });
  await proc.waitForPort(port, { timeout: 180_000 });

  const sandboxId = typeof body.sandboxId === "string" ? body.sandboxId : "";
  const token = previewTokenFromSandboxId(sandboxId);
  const exposed = await sandbox.exposePort(port, {
    hostname,
    token,
    name: "vite-dev",
  });

  return json({
    ok: true,
    previewUrl: exposed.url,
    processId: proc.id,
    port,
  });
}

async function routeStopPreview(sandbox: SandboxClient, env: Env): Promise<Response> {
  await sandbox.killAllProcesses();
  const hostname = env.SANDBOX_PREVIEW_HOSTNAME?.trim();
  if (hostname && hostname !== "localhost") {
    await clearExposedPorts(sandbox, hostname);
  }
  await sandbox.setKeepAlive(false);
  return json({ ok: true });
}

async function routeStatus(sandbox: SandboxClient, env: Env): Promise<Response> {
  const processes = await sandbox.listProcesses();
  const hostname = env.SANDBOX_PREVIEW_HOSTNAME?.trim();
  const exposed =
    hostname && hostname !== "localhost"
      ? await sandbox.getExposedPorts(hostname)
      : [];
  return json({
    processes,
    exposed,
  });
}

async function routeProcessLogs(
  sandbox: SandboxClient,
  body: Record<string, unknown>
): Promise<Response> {
  const processId = typeof body.processId === "string" ? body.processId.trim() : "";
  if (!processId) {
    return json({ error: "processId is required" }, 400);
  }
  const logs = await sandbox.getProcessLogs(processId);
  return json({ logs });
}

function joinAbsolute(rootPath: string, projectPath: string): string {
  const normalized = projectPath.startsWith("/") ? projectPath.slice(1) : projectPath;
  const base = rootPath.endsWith("/") ? rootPath.slice(0, -1) : rootPath;
  return `${base}/${normalized}`;
}

function posixDirname(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) {
    return "";
  }
  return path.slice(0, idx);
}

function previewTokenFromSandboxId(sandboxId: string): string {
  const cleaned = sandboxId.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const slice = cleaned.slice(0, 16);
  if (slice.length >= 4) {
    return slice;
  }
  const padded = `wm${cleaned.replace(/-/g, "")}`;
  return padded.slice(0, 16).padEnd(4, "x");
}
