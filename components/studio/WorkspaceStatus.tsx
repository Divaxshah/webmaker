"use client";

import type { WorkspaceSnapshot } from "@/lib/types";

interface WorkspaceStatusProps {
  workspace?: WorkspaceSnapshot;
  onRefresh?: () => void;
  onReconnectSandbox?: () => void;
}

export function WorkspaceStatus({
  workspace,
  onRefresh,
  onReconnectSandbox,
}: WorkspaceStatusProps) {
  if (!workspace) {
    return null;
  }

  const { runtime } = workspace;
  const previewStatus = runtime.preview.status;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {runtime.providerLabel ?? runtime.provider}
      </span>
      <span className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
        Runtime: {runtime.status}
      </span>
      <span className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
        Preview: {previewStatus}
      </span>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary"
        >
          Refresh Runtime
        </button>
      ) : null}
      {onReconnectSandbox &&
      workspace.runtime.provider === "sandbox" ? (
        <button
          type="button"
          onClick={onReconnectSandbox}
          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary transition hover:bg-primary/15"
        >
          Sync &amp; Restart Preview
        </button>
      ) : null}
    </div>
  );
}
