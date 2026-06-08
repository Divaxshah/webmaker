import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type Dockerode from "dockerode";
import { mergeProjectWithBootstrap } from "@/lib/download-bootstrap";
import { normalizeProjectPath } from "@/lib/project";
import type { GeneratedProject } from "@/lib/types";

const PREVIEW_PORT = 5173;
const DEV_SERVER_TIMEOUT_MS = 180_000;
const IDLE_TTL_MS = 30 * 60 * 1000;
const MAX_CONCURRENT_CONTAINERS = 10;
const INSTALL_CMD =
  "npm install && npm run dev -- --host 0.0.0.0 --port 5173";

const WORKSPACE_ROOT = path.join(process.cwd(), ".webmaker", "workspaces");

/** Never overwrite these on disk once a workspace is scaffolded (avoids Vite restart storms). */
const SCAFFOLD_PATHS = new Set([
  "/package.json",
  "/index.html",
  "/vite.config.js",
  "/vite.config.ts",
  "/tsconfig.json",
  "/tsconfig.node.json",
  "/tailwind.config.js",
  "/tailwind.config.ts",
  "/postcss.config.js",
  "/postcss.config.ts",
  "/.gitignore",
  "/README.md",
]);

export interface DockerPreviewSession {
  workspaceId: string;
  containerId: string;
  hostPort: number;
  url: string;
  startedAt: string;
  reused?: boolean;
}

interface ActivePreview {
  session: DockerPreviewSession;
  container: Dockerode.Container;
  ttlTimer: ReturnType<typeof setTimeout>;
  lastActivityAt: number;
}

const activePreviews = new Map<string, ActivePreview>();
const previewLocks = new Map<string, Promise<void>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sanitizeWorkspaceId = (workspaceId: string): string =>
  workspaceId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "default";

export const getWorkspaceDiskPath = (workspaceId: string): string =>
  path.join(WORKSPACE_ROOT, sanitizeWorkspaceId(workspaceId));

const withPreviewLock = async <T>(
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> => {
  const key = sanitizeWorkspaceId(workspaceId);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = previewLocks.get(key) ?? Promise.resolve();
  previewLocks.set(key, previous.then(() => gate));
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
};

const getDockerImage = (): string =>
  process.env.WEBMAKER_DOCKER_IMAGE?.trim() || "node:20-alpine";

async function getDocker(): Promise<Dockerode> {
  const Docker = (await import("dockerode")).default;
  const socketPath = process.env.DOCKER_SOCKET?.trim() || "/var/run/docker.sock";
  return new Docker({ socketPath });
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    const docker = await getDocker();
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const toRelativeDiskPath = (projectPath: string): string => {
  const normalized = normalizeProjectPath(projectPath).replace(/^\/+/, "");
  const resolved = path.normalize(normalized);
  if (resolved.startsWith("..") || path.isAbsolute(resolved)) {
    throw new Error(`Unsafe project path: ${projectPath}`);
  }
  return resolved;
};

/** Decode Docker multiplexed stdout/stderr stream (8-byte header per frame). */
function demuxDockerLogChunk(chunk: Buffer): string {
  let offset = 0;
  let output = "";

  while (offset < chunk.length) {
    if (chunk.length - offset < 8) {
      output += chunk.subarray(offset).toString("utf8");
      break;
    }

    const frameSize = chunk.readUInt32BE(offset + 4);
    offset += 8;

    if (frameSize <= 0 || offset + frameSize > chunk.length) {
      output += chunk.subarray(offset).toString("utf8");
      break;
    }

    output += chunk.subarray(offset, offset + frameSize).toString("utf8");
    offset += frameSize;
  }

  return output;
}

/**
 * Write project files to disk. Hermes is the source of truth — preview must not
 * rewrite scaffold config once package.json exists (that restarts Vite mid-HMR).
 */
export async function syncProjectToWorkspaceDisk(
  workspaceId: string,
  project?: GeneratedProject
): Promise<string> {
  const workspacePath = getWorkspaceDiskPath(workspaceId);
  await mkdir(workspacePath, { recursive: true });

  if (!project) {
    return workspacePath;
  }

  const packageJsonPath = path.join(workspacePath, "package.json");
  const scaffolded = await pathExists(packageJsonPath);

  if (!scaffolded) {
    const files = mergeProjectWithBootstrap(project);
    for (const [filePath, file] of Object.entries(files)) {
      const diskPath = path.join(workspacePath, toRelativeDiskPath(filePath));
      await mkdir(path.dirname(diskPath), { recursive: true });
      await writeFile(diskPath, file.code, "utf8");
    }
    return workspacePath;
  }

  for (const [filePath, file] of Object.entries(project.files)) {
    const normalized = normalizeProjectPath(filePath);
    if (SCAFFOLD_PATHS.has(normalized)) {
      continue;
    }
    const diskPath = path.join(workspacePath, toRelativeDiskPath(normalized));
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, file.code, "utf8");
  }

  return workspacePath;
}

async function waitForDevServer(port: number, timeoutMs = DEV_SERVER_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(2_500),
      });
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await sleep(1_000);
  }

  throw new Error("Dev server did not become ready in the Docker container.");
}

async function readContainerHostPort(container: Dockerode.Container): Promise<number> {
  const info = await container.inspect();
  const bindings = info.NetworkSettings.Ports?.[`${PREVIEW_PORT}/tcp`];
  const hostPort = bindings?.[0]?.HostPort;
  if (!hostPort) {
    throw new Error("Docker did not assign a host port for the preview container.");
  }
  return Number(hostPort);
}

async function isContainerRunning(container: Dockerode.Container): Promise<boolean> {
  try {
    const info = await container.inspect();
    return info.State.Running === true;
  } catch {
    return false;
  }
}

async function hydrateActivePreviewFromDocker(
  key: string,
  container: Dockerode.Container
): Promise<ActivePreview | null> {
  if (!(await isContainerRunning(container))) {
    return null;
  }

  const hostPort = await readContainerHostPort(container);
  const info = await container.inspect();
  const session: DockerPreviewSession = {
    workspaceId: key,
    containerId: info.Id,
    hostPort,
    url: `http://127.0.0.1:${hostPort}`,
    startedAt: info.State.StartedAt ?? new Date().toISOString(),
    reused: true,
  };

  const ttlTimer = setTimeout(() => {
    void stopDockerPreview(key);
  }, IDLE_TTL_MS);

  const active: ActivePreview = {
    session,
    container,
    ttlTimer,
    lastActivityAt: Date.now(),
  };

  activePreviews.set(key, active);
  return active;
}

async function resolvePreviewContainer(key: string): Promise<ActivePreview | null> {
  const cached = activePreviews.get(key);
  if (cached && (await isContainerRunning(cached.container))) {
    return cached;
  }

  if (cached) {
    clearPreviewTtl(key);
    activePreviews.delete(key);
  }

  const docker = await getDocker();
  const listed = await docker.listContainers({
    all: false,
    filters: {
      label: [`webmaker.workspace=${key}`],
    },
  });

  if (listed.length === 0) {
    return null;
  }

  const container = docker.getContainer(listed[0].Id);
  return hydrateActivePreviewFromDocker(key, container);
}

function clearPreviewTtl(key: string): void {
  const active = activePreviews.get(key);
  if (!active) return;
  clearTimeout(active.ttlTimer);
}

function schedulePreviewTtl(key: string): void {
  clearPreviewTtl(key);
  const active = activePreviews.get(key);
  if (!active) return;

  active.ttlTimer = setTimeout(() => {
    void stopDockerPreview(key);
  }, IDLE_TTL_MS);
}

export function touchDockerPreviewActivity(workspaceId: string): void {
  const key = sanitizeWorkspaceId(workspaceId);
  const active = activePreviews.get(key);
  if (!active) return;
  active.lastActivityAt = Date.now();
  schedulePreviewTtl(key);
}

function evictOldestPreviewIfNeeded(): void {
  if (activePreviews.size < MAX_CONCURRENT_CONTAINERS) return;

  let oldestKey: string | null = null;
  let oldestActivity = Infinity;
  for (const [key, active] of activePreviews) {
    if (active.lastActivityAt < oldestActivity) {
      oldestActivity = active.lastActivityAt;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    void stopDockerPreview(oldestKey);
  }
}

export async function stopDockerPreview(workspaceId: string): Promise<void> {
  const key = sanitizeWorkspaceId(workspaceId);
  const active = activePreviews.get(key);
  if (!active) return;

  clearPreviewTtl(key);
  activePreviews.delete(key);

  try {
    await active.container.stop({ t: 2 });
  } catch {
    try {
      await active.container.kill();
    } catch {
      // Container may already be gone.
    }
  }
}

export interface StartDockerPreviewOptions {
  force?: boolean;
  project?: GeneratedProject;
}

export async function startDockerPreview(
  workspaceId: string,
  options: StartDockerPreviewOptions = {}
): Promise<DockerPreviewSession> {
  return withPreviewLock(workspaceId, async () => {
    const key = sanitizeWorkspaceId(workspaceId);

    if (!options.force) {
      const existing = await resolvePreviewContainer(key);
      if (existing) {
        touchDockerPreviewActivity(key);
        return { ...existing.session, reused: true };
      }
    } else {
      await stopDockerPreview(key);
    }

    const workspacePath = getWorkspaceDiskPath(key);
    const packageJsonPath = path.join(workspacePath, "package.json");

    if (!(await pathExists(packageJsonPath))) {
      if (!options.project) {
        throw new Error(
          "Workspace is missing package.json on disk. Run a generation first."
        );
      }
      await syncProjectToWorkspaceDisk(key, options.project);
    }

    if (!(await pathExists(packageJsonPath))) {
      throw new Error(
        "Workspace is missing package.json on disk. Run a generation first or sync the project."
      );
    }

    evictOldestPreviewIfNeeded();

    const docker = await getDocker();
    await docker.ping();

    const container = await docker.createContainer({
      Image: getDockerImage(),
      Cmd: ["sh", "-c", INSTALL_CMD],
      WorkingDir: "/app",
      ExposedPorts: {
        [`${PREVIEW_PORT}/tcp`]: {},
      },
      HostConfig: {
        Binds: [`${workspacePath}:/app`],
        PortBindings: {
          [`${PREVIEW_PORT}/tcp`]: [{ HostPort: "" }],
        },
        Memory: 512 * 1024 * 1024,
        CpuQuota: 50_000,
        NetworkMode: "bridge",
        AutoRemove: true,
      },
      Labels: {
        "webmaker.preview": "true",
        "webmaker.workspace": key,
      },
    });

    await container.start();

    const hostPort = await readContainerHostPort(container);
    await waitForDevServer(hostPort);

    const url = `http://127.0.0.1:${hostPort}`;
    const session: DockerPreviewSession = {
      workspaceId: key,
      containerId: container.id,
      hostPort,
      url,
      startedAt: new Date().toISOString(),
      reused: false,
    };

    const ttlTimer = setTimeout(() => {
      void stopDockerPreview(key);
    }, IDLE_TTL_MS);

    activePreviews.set(key, {
      session,
      container,
      ttlTimer,
      lastActivityAt: Date.now(),
    });

    return session;
  });
}

export function getActiveDockerPreview(
  workspaceId: string
): DockerPreviewSession | null {
  return activePreviews.get(sanitizeWorkspaceId(workspaceId))?.session ?? null;
}

export async function streamDockerPreviewLogs(
  workspaceId: string,
  onChunk: (line: string) => void
): Promise<() => void> {
  const key = sanitizeWorkspaceId(workspaceId);
  const active = await resolvePreviewContainer(key);
  if (!active) {
    throw new Error("No active Docker preview for this workspace.");
  }

  const stream = await active.container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100,
    timestamps: false,
  });

  const onData = (chunk: Buffer) => {
    onChunk(demuxDockerLogChunk(chunk));
    touchDockerPreviewActivity(key);
  };

  stream.on("data", onData);

  return () => {
    stream.removeListener("data", onData);
    try {
      const readable = stream as NodeJS.ReadableStream & { destroy?: () => void };
      readable.destroy?.();
    } catch {
      // Best-effort detach.
    }
  };
}
