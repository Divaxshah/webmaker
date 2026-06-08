/**
 * Central place for environment expectations (used by /api/health and docs).
 * Server-only values — never import from client components.
 */

export interface WebmakerHealthChecks {
  /** Optional: durable preview IDs and dashboard sync across restarts. */
  upstashRedis: { ok: boolean; hint?: string };
  /** Required for Hermes-backed generation. */
  hermesBridge: {
    ok: boolean;
    hint?: string;
    path?: string;
    python?: string;
    model?: string;
    provider?: string;
    hermesHome?: string;
  };
  /** Required for Studio Docker preview (bind-mount workspaces). */
  dockerPreview: { ok: boolean; hint?: string };
}

export interface WebmakerHealthResult {
  status: "ok" | "degraded";
  checks: WebmakerHealthChecks;
  messages: string[];
}

const hint = {
  upstashRedis:
    "Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for shared preview links and dashboard sync across restarts.",
  hermesBridge:
    "Set WEBMAKER_HERMES_PATH and WEBMAKER_HERMES_PYTHON for Hermes-backed generation.",
  dockerPreview:
    "Install Docker and ensure the app can access DOCKER_SOCKET (default /var/run/docker.sock) for Studio preview containers.",
};

export const getWebmakerHealth = async (): Promise<WebmakerHealthResult> => {
  const upstashOk =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());

  const hermesPath = process.env.WEBMAKER_HERMES_PATH?.trim() ?? "";
  const hermesPython = process.env.WEBMAKER_HERMES_PYTHON?.trim() || "python3";
  const hermesOk = Boolean(hermesPath) && Boolean(hermesPython.trim());

  let runtimeInfo = {
    model: "Hermes configured default",
    provider: "Hermes configured default",
    hermesHome: "",
  };
  try {
    const { readHermesRuntimeInfo } = await import("@/lib/hermes-bridge");
    runtimeInfo = await readHermesRuntimeInfo();
  } catch {
    // Health still reports path/python even if runtime info probe fails.
  }

  let dockerOk = false;
  try {
    const { isDockerAvailable } = await import("@/lib/docker-preview");
    dockerOk = await isDockerAvailable();
  } catch {
    dockerOk = false;
  }

  const checks: WebmakerHealthChecks = {
    upstashRedis: upstashOk ? { ok: true } : { ok: false, hint: hint.upstashRedis },
    hermesBridge: hermesOk
      ? {
          ok: true,
          path: hermesPath,
          python: hermesPython,
          model: runtimeInfo.model,
          provider: runtimeInfo.provider,
          hermesHome: runtimeInfo.hermesHome ?? "",
        }
      : {
          ok: false,
          hint: hint.hermesBridge,
          path: hermesPath || undefined,
          python: hermesPython,
          model: runtimeInfo.model,
          provider: runtimeInfo.provider,
          hermesHome: runtimeInfo.hermesHome ?? "",
        },
    dockerPreview: dockerOk
      ? { ok: true }
      : { ok: false, hint: hint.dockerPreview },
  };

  const messages: string[] = [];
  if (!upstashOk) messages.push(hint.upstashRedis);
  if (!hermesOk) messages.push(hint.hermesBridge);
  if (!dockerOk) messages.push(hint.dockerPreview);

  const criticalOk = hermesOk && dockerOk;
  return {
    status: criticalOk && upstashOk ? "ok" : criticalOk ? "degraded" : "degraded",
    checks,
    messages,
  };
};
