export interface CloudflareSandboxConfig {
  accountId: string;
  sandboxBinding: string;
  workerName: string;
  durableObjectNamespace?: string;
  defaultRootPath: string;
}

/** HTTP bridge to a Worker that holds the Sandbox SDK (`workers/sandbox-gateway`). */
export interface SandboxGatewayConfig {
  baseUrl: string;
  secret: string;
}

export interface WebmakerRuntimeConfig {
  defaultProvider: "virtual" | "sandbox";
  /** Legacy/account metadata — informational once gateway auth is used. */
  cloudflare: CloudflareSandboxConfig | null;
  /** Required for real sandbox execution from Next.js (Workers-only SDK). */
  gateway: SandboxGatewayConfig | null;
}

export const getRuntimeConfig = (): WebmakerRuntimeConfig => {
  const gatewayUrl = process.env.SANDBOX_GATEWAY_URL?.trim() ?? "";
  const gatewaySecret = process.env.SANDBOX_GATEWAY_SECRET?.trim() ?? "";

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const sandboxBinding = process.env.CLOUDFLARE_SANDBOX_BINDING?.trim() ?? "";
  const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() ?? "";
  const durableObjectNamespace =
    process.env.CLOUDFLARE_DO_NAMESPACE?.trim() || undefined;
  const defaultRootPath =
    process.env.CLOUDFLARE_SANDBOX_ROOT?.trim() || "/workspace";

  const gatewayReady = gatewayUrl.length > 0 && gatewaySecret.length > 0;

  const legacyCloudflareMetaReady =
    accountId.length > 0 &&
    sandboxBinding.length > 0 &&
    workerName.length > 0;

  const cloudflare: CloudflareSandboxConfig | null =
    gatewayReady || legacyCloudflareMetaReady
      ? {
          accountId: accountId || "—",
          sandboxBinding: sandboxBinding || "SANDBOX_GATEWAY",
          workerName: workerName || gatewayUrl || "webmaker-sandbox-gateway",
          durableObjectNamespace,
          defaultRootPath,
        }
      : null;

  return {
    defaultProvider: gatewayReady ? "sandbox" : "virtual",
    cloudflare,
    gateway: gatewayReady
      ? {
          baseUrl: gatewayUrl.replace(/\/$/, ""),
          secret: gatewaySecret,
        }
      : null,
  };
};

/** True when gateway URL + secret are set (live sandbox from Next.js). */
export const hasSandboxGateway = (): boolean =>
  getRuntimeConfig().gateway !== null;

/** Back-compat name: gateway configured for executable sandbox. */
export const hasCloudflareSandboxConfig = (): boolean => hasSandboxGateway();
