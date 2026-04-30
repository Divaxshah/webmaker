import { getBootstrapFiles } from "@/lib/download-bootstrap";
import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";
import { getRuntimeProviderLabel } from "@/lib/runtime-config";
import type { RuntimeIssue, RuntimeResult } from "@/lib/workspace-provider";

export type CloudflareRuntimeAction =
  | "status"
  | "sync_workspace"
  | "install_dependencies"
  | "run_command"
  | "verify_build"
  | "start_preview"
  | "get_logs"
  | "stop_preview";

export interface CloudflareGatewayRequest {
  action: CloudflareRuntimeAction;
  workspace: WorkspaceSnapshot;
  command?: string;
  processId?: string;
  bootstrapFiles?: Record<string, string>;
}

interface CloudflareGatewayResponse {
  ok: boolean;
  workspace: WorkspaceSnapshot;
  output?: string;
  error?: string;
  structuredErrors?: RuntimeIssue[];
  data?: unknown;
}

const getGatewayUrl = (): string | null =>
  process.env.CLOUDFLARE_SANDBOX_GATEWAY_URL?.trim() ?? null;

const getGatewayToken = (): string | null =>
  process.env.CLOUDFLARE_SANDBOX_GATEWAY_TOKEN?.trim() ?? null;

const withCloudflareRuntimeShape = (
  workspace: WorkspaceSnapshot
): WorkspaceSnapshot => ({
  ...workspace,
  runtime: {
    ...workspace.runtime,
    provider: "cloudflare-sandbox",
    providerLabel: getRuntimeProviderLabel("cloudflare-sandbox"),
    providerMeta: {
      ...(workspace.runtime.providerMeta ?? {}),
      mode: "cloudflare-sandbox",
      sdkPackage: "@cloudflare/sandbox",
      gatewayConfigured: getGatewayUrl() ? "true" : "false",
    },
  },
});

const gatewayNotConfiguredResult = (
  workspace: WorkspaceSnapshot
): RuntimeResult => ({
  ok: false,
  workspace: {
    ...withCloudflareRuntimeShape(workspace),
    runtime: {
      ...withCloudflareRuntimeShape(workspace).runtime,
      status: "error",
      lastError:
        "Missing CLOUDFLARE_SANDBOX_GATEWAY_URL. Deploy the worker gateway and set CLOUDFLARE_SANDBOX_GATEWAY_URL and CLOUDFLARE_SANDBOX_GATEWAY_TOKEN in the Next.js app.",
    },
  },
  error:
    "Missing CLOUDFLARE_SANDBOX_GATEWAY_URL. Deploy the worker gateway and set CLOUDFLARE_SANDBOX_GATEWAY_URL and CLOUDFLARE_SANDBOX_GATEWAY_TOKEN in the Next.js app.",
});

export const callCloudflareSandboxGateway = async (
  action: CloudflareRuntimeAction,
  workspace: WorkspaceSnapshot,
  options?: { command?: string; processId?: string }
): Promise<RuntimeResult> => {
  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) {
    return gatewayNotConfiguredResult(workspace);
  }

  const bootstrapFiles = getBootstrapFiles(workspace.project as GeneratedProject);
  const payload: CloudflareGatewayRequest = {
    action,
    workspace: withCloudflareRuntimeShape(workspace),
    command: options?.command,
    processId: options?.processId,
    bootstrapFiles,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getGatewayToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(gatewayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cloudflare Sandbox gateway request failed.";
    return {
      ok: false,
      workspace: {
        ...withCloudflareRuntimeShape(workspace),
        runtime: {
          ...withCloudflareRuntimeShape(workspace).runtime,
          status: "error",
          lastError: message,
        },
      },
      error: message,
    };
  }

  const json = (await response.json()) as Partial<CloudflareGatewayResponse>;
  const nextWorkspace = json.workspace
    ? withCloudflareRuntimeShape(json.workspace)
    : withCloudflareRuntimeShape(workspace);

  if (!response.ok || json.ok === false) {
    return {
      ok: false,
      workspace: {
        ...nextWorkspace,
        runtime: {
          ...nextWorkspace.runtime,
          status: "error",
          lastError: json.error ?? `Gateway request failed with ${response.status}.`,
        },
      },
      output: json.output,
      error: json.error ?? `Gateway request failed with ${response.status}.`,
      structuredErrors: json.structuredErrors,
    };
  }

  return {
    ok: true,
    workspace: nextWorkspace,
    output: json.output,
    error: json.error,
    structuredErrors: json.structuredErrors,
    data: json.data,
  };
};
