/**
 * Central place for environment expectations (used by /api/health and docs).
 * Server-only values — never import from client components.
 */

export interface WebmakerHealthChecks {
  /** Optional but recommended on Vercel/serverless: durable preview IDs (/api/preview). */
  upstashRedis: { ok: boolean; hint?: string };
  /** Optional: needed when using the Cloudflare Sandbox runtime provider. */
  cloudflareSandboxGateway: { ok: boolean; hint?: string };
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
}

export interface WebmakerHealthResult {
  status: "ok" | "degraded";
  checks: WebmakerHealthChecks;
  /** Actionable messages for operators (only missing/warn items). */
  messages: string[];
}

const hint = {
  upstashRedis:
    "Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for reliable shared preview links on serverless. Single local Node process can omit (uses temp files).",
  cloudflareSandboxGateway:
    "Set CLOUDFLARE_SANDBOX_GATEWAY_URL and optionally CLOUDFLARE_SANDBOX_GATEWAY_TOKEN after deploying the Cloudflare Sandbox worker gateway.",
  hermesBridge:
    "Set WEBMAKER_HERMES_PATH and WEBMAKER_HERMES_PYTHON for Hermes-backed generation.",
};

export const getWebmakerHealth = async (): Promise<WebmakerHealthResult> => {
  const upstashOk =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
  const cloudflareGatewayOk = Boolean(
    process.env.CLOUDFLARE_SANDBOX_GATEWAY_URL?.trim()
  );
  const hermesPathOk = Boolean(
    (process.env.WEBMAKER_HERMES_PATH ||
      "/media/avinyaa/4ad5a4e0-4ac1-480f-90c1-386d861b6f342/agent/hermes-agent").trim()
  );
  const hermesPython = process.env.WEBMAKER_HERMES_PYTHON || "python3";
  const hermesPath =
    process.env.WEBMAKER_HERMES_PATH ||
    "/media/avinyaa/4ad5a4e0-4ac1-480f-90c1-386d861b6f342/agent/hermes-agent";
  let runtimeInfo = {
    model: "Hermes configured default",
    provider: "Hermes configured default",
    hermesHome: "",
  };
  try {
    const { readHermesRuntimeInfo } = await import("@/lib/hermes-bridge");
    runtimeInfo = await readHermesRuntimeInfo();
  } catch {
    runtimeInfo = {
      model: "Hermes configured default",
      provider: "Hermes configured default",
      hermesHome: "",
    };
  }
  const hermesPythonOk = Boolean(hermesPython.trim());
  const hermesOk = hermesPathOk && hermesPythonOk;

  const checks: WebmakerHealthChecks = {
    upstashRedis: upstashOk ? { ok: true } : { ok: false, hint: hint.upstashRedis },
    cloudflareSandboxGateway: cloudflareGatewayOk
      ? { ok: true }
      : { ok: false, hint: hint.cloudflareSandboxGateway },
    hermesBridge: hermesOk
      ? {
          ok: true,
          path: hermesPath,
          python: hermesPython,
          model: runtimeInfo.model,
          provider: runtimeInfo.provider,
          hermesHome: "hermesHome" in runtimeInfo ? runtimeInfo.hermesHome : "",
        }
      : {
          ok: false,
          hint: hint.hermesBridge,
          path: hermesPath,
          python: hermesPython,
          model: runtimeInfo.model,
          provider: runtimeInfo.provider,
          hermesHome: "hermesHome" in runtimeInfo ? runtimeInfo.hermesHome : "",
        },
  };

  const messages: string[] = [];
  if (!upstashOk) messages.push(hint.upstashRedis);
  if (!cloudflareGatewayOk) messages.push(hint.cloudflareSandboxGateway);
  if (!hermesOk) messages.push(hint.hermesBridge);

  const allGreen = upstashOk && hermesOk;
  return {
    status: allGreen ? "ok" : "degraded",
    checks,
    messages,
  };
};
