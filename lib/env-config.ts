/**
 * Central place for environment expectations (used by /api/health and docs).
 * Server-only values — never import from client components.
 */

export interface WebmakerHealthChecks {
  /** Required: AI generation (/api/generate). */
  openrouter: { ok: boolean; hint?: string };
  /** Optional: live Cloudflare Sandbox (Studio runtime controls). */
  sandboxGateway: { ok: boolean; hint?: string };
  /** Optional but recommended on Vercel/serverless: durable preview IDs (/api/preview). */
  upstashRedis: { ok: boolean; hint?: string };
}

export interface WebmakerHealthResult {
  status: "ok" | "degraded";
  checks: WebmakerHealthChecks;
  /** Actionable messages for operators (only missing/warn items). */
  messages: string[];
}

const hint = {
  openrouter:
    "Set OPENROUTER_API_KEY — https://openrouter.ai/ — required for AI generation.",
  sandboxGateway:
    "Set SANDBOX_GATEWAY_URL + SANDBOX_GATEWAY_SECRET after deploying workers/sandbox-gateway (see DEPLOY.md). Without this, Sandpack preview still works but live sandbox controls do not.",
  upstashRedis:
    "Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for reliable shared preview links on serverless. Single local Node process can omit (uses temp files).",
};

export const getWebmakerHealth = (): WebmakerHealthResult => {
  const openrouterOk = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const gatewayOk =
    Boolean(process.env.SANDBOX_GATEWAY_URL?.trim()) &&
    Boolean(process.env.SANDBOX_GATEWAY_SECRET?.trim());
  const upstashOk =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());

  const checks: WebmakerHealthChecks = {
    openrouter: openrouterOk
      ? { ok: true }
      : { ok: false, hint: hint.openrouter },
    sandboxGateway: gatewayOk
      ? { ok: true }
      : { ok: false, hint: hint.sandboxGateway },
    upstashRedis: upstashOk ? { ok: true } : { ok: false, hint: hint.upstashRedis },
  };

  const messages: string[] = [];
  if (!openrouterOk) messages.push(hint.openrouter);
  if (!gatewayOk) messages.push(hint.sandboxGateway);
  if (!upstashOk) messages.push(hint.upstashRedis);

  const allGreen = openrouterOk && gatewayOk && upstashOk;
  return {
    status: allGreen ? "ok" : "degraded",
    checks,
    messages,
  };
};
