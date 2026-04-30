/**
 * Central place for environment expectations (used by /api/health and docs).
 * Server-only values — never import from client components.
 */

export interface WebmakerHealthChecks {
  /** Required: AI generation (/api/generate). */
  openrouter: { ok: boolean; hint?: string };
  /** Optional but recommended on Vercel/serverless: durable preview IDs (/api/preview). */
  upstashRedis: { ok: boolean; hint?: string };
  /** Optional: needed when using the Cloudflare Sandbox runtime provider. */
  cloudflareSandboxGateway: { ok: boolean; hint?: string };
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
  upstashRedis:
    "Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for reliable shared preview links on serverless. Single local Node process can omit (uses temp files).",
  cloudflareSandboxGateway:
    "Set CLOUDFLARE_SANDBOX_GATEWAY_URL and optionally CLOUDFLARE_SANDBOX_GATEWAY_TOKEN after deploying the Cloudflare Sandbox worker gateway.",
};

export const getWebmakerHealth = (): WebmakerHealthResult => {
  const openrouterOk = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const upstashOk =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
  const cloudflareGatewayOk = Boolean(
    process.env.CLOUDFLARE_SANDBOX_GATEWAY_URL?.trim()
  );

  const checks: WebmakerHealthChecks = {
    openrouter: openrouterOk
      ? { ok: true }
      : { ok: false, hint: hint.openrouter },
    upstashRedis: upstashOk ? { ok: true } : { ok: false, hint: hint.upstashRedis },
    cloudflareSandboxGateway: cloudflareGatewayOk
      ? { ok: true }
      : { ok: false, hint: hint.cloudflareSandboxGateway },
  };

  const messages: string[] = [];
  if (!openrouterOk) messages.push(hint.openrouter);
  if (!upstashOk) messages.push(hint.upstashRedis);
  if (!cloudflareGatewayOk) messages.push(hint.cloudflareSandboxGateway);

  const allGreen = openrouterOk && upstashOk;
  return {
    status: allGreen ? "ok" : "degraded",
    checks,
    messages,
  };
};
