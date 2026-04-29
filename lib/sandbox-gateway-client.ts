import "server-only";

import { getRuntimeConfig } from "@/lib/runtime-config";

export interface GatewayExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GatewayStartPreviewResult {
  ok: boolean;
  previewUrl: string;
  processId: string;
  port: number;
}

export interface GatewayStatusResult {
  processes: unknown[];
  exposed: Array<{ port: number; url: string; status: "active" | "inactive" }>;
}

const postGateway = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const { gateway } = getRuntimeConfig();
  if (!gateway) {
    throw new Error("Sandbox gateway is not configured (set SANDBOX_GATEWAY_URL and SANDBOX_GATEWAY_SECRET).");
  }

  const url = `${gateway.baseUrl}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gateway.secret}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : text || `Gateway error ${response.status}`;
    throw new Error(message);
  }

  return parsed as T;
};

export const sandboxGatewaySyncProject = async (input: {
  sandboxId: string;
  rootPath: string;
  files: Record<string, string>;
}): Promise<{ ok: boolean; written: number }> =>
  postGateway("/v1/sync", {
    sandboxId: input.sandboxId,
    rootPath: input.rootPath,
    files: input.files,
  });

export const sandboxGatewayExec = async (input: {
  sandboxId: string;
  command: string;
  cwd?: string;
}): Promise<GatewayExecResult> =>
  postGateway("/v1/exec", {
    sandboxId: input.sandboxId,
    command: input.command,
    ...(input.cwd ? { cwd: input.cwd } : {}),
  });

export const sandboxGatewayStartPreview = async (input: {
  sandboxId: string;
  rootPath: string;
  port?: number;
  command?: string;
}): Promise<GatewayStartPreviewResult> =>
  postGateway("/v1/start-preview", {
    sandboxId: input.sandboxId,
    rootPath: input.rootPath,
    ...(input.port !== undefined ? { port: input.port } : {}),
    ...(input.command ? { command: input.command } : {}),
  });

export const sandboxGatewayStopPreview = async (input: {
  sandboxId: string;
}): Promise<{ ok: boolean }> =>
  postGateway("/v1/stop-preview", {
    sandboxId: input.sandboxId,
  });

export const sandboxGatewayStatus = async (input: {
  sandboxId: string;
}): Promise<GatewayStatusResult> =>
  postGateway("/v1/status", {
    sandboxId: input.sandboxId,
  });

export const sandboxGatewayProcessLogs = async (input: {
  sandboxId: string;
  processId: string;
}): Promise<{ logs: string }> =>
  postGateway("/v1/process-logs", {
    sandboxId: input.sandboxId,
    processId: input.processId,
  });
