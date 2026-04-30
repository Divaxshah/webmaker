export type RuntimeProviderMode = "local" | "virtual" | "cloudflare-sandbox";
export type SelectableRuntimeProviderMode = "local" | "cloudflare-sandbox";

/** Runtime provider selection. Local is the default runtime; Cloudflare Sandbox is selectable behind the same contract. */
export interface WebmakerRuntimeConfig {
  readonly mode: RuntimeProviderMode;
}

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

  return {
    mode: isRuntimeProviderMode(requestedMode) ? requestedMode : "local",
  };
};
