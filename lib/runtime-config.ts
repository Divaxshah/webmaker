export type RuntimeProviderMode = "local" | "virtual" | "cloudflare-sandbox";
export type SelectableRuntimeProviderMode = "local" | "cloudflare-sandbox";

/** Runtime provider selection. Local is the default runtime; Cloudflare Sandbox is selectable behind the same contract. */
export interface WebmakerRuntimeConfig {
  readonly mode: RuntimeProviderMode;
  readonly runtimeToolsEnabled: boolean;
}

const envFlag = (value: string | undefined): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
};

export const areRuntimeToolsEnabled = (): boolean => {
  const explicitEnable = envFlag(process.env.WEBMAKER_ENABLE_RUNTIME_TOOLS);
  if (explicitEnable !== null) return explicitEnable;

  const explicitDisable = envFlag(process.env.WEBMAKER_DISABLE_RUNTIME_TOOLS);
  if (explicitDisable !== null) return !explicitDisable;

  const isVercelHosted =
    process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string";

  return !isVercelHosted;
};

export const isRuntimeProviderMode = (
  value: unknown
): value is RuntimeProviderMode =>
  value === "local" || value === "virtual" || value === "cloudflare-sandbox";

export const isSelectableRuntimeProviderMode = (
  value: unknown
): value is SelectableRuntimeProviderMode =>
  value === "local" || value === "cloudflare-sandbox";

export const getRuntimeProviderLabel = (mode: RuntimeProviderMode): string => {
  switch (mode) {
    case "cloudflare-sandbox":
      return "Cloudflare Sandbox";
    case "virtual":
      return "Virtual Workspace";
    case "local":
    default:
      return "Local Runtime";
  }
};

export const getRuntimeConfig = (): WebmakerRuntimeConfig => {
  const requestedMode = process.env.WEBMAKER_RUNTIME_PROVIDER;
  const runtimeToolsEnabled = areRuntimeToolsEnabled();
  const requested = isRuntimeProviderMode(requestedMode) ? requestedMode : null;
  const mode =
    !runtimeToolsEnabled
      ? "virtual"
      : requested ?? "local";

  return {
    mode,
    runtimeToolsEnabled,
  };
};
