"use client";

import { FormEvent, useState } from "react";
import {
  Loader2,
  Play,
  RefreshCw,
  ScrollText,
  SquareTerminal,
  Terminal,
  UploadCloud,
  Hammer,
} from "lucide-react";
import type { RuntimeAction } from "@/lib/runtime-service";
import type { WorkspaceSnapshot } from "@/lib/types";

interface RuntimeControlsProps {
  workspace?: WorkspaceSnapshot;
  disabled?: boolean;
  onRunAction: (
    action: RuntimeAction,
    options?: { command?: string; processId?: string }
  ) => Promise<void>;
}

export function RuntimeControls({
  workspace,
  disabled,
  onRunAction,
}: RuntimeControlsProps) {
  const [command, setCommand] = useState("");
  const [runningAction, setRunningAction] = useState<RuntimeAction | null>(null);

  if (!workspace) {
    return null;
  }

  const previewPid =
    workspace.runtime.providerMeta?.previewProcessId?.trim() ?? "";

  const runAction = async (
    action: RuntimeAction,
    options?: { command?: string; processId?: string }
  ) => {
    setRunningAction(action);
    try {
      await onRunAction(action, options);
      if (action === "run_command") {
        setCommand("");
      }
    } finally {
      setRunningAction(null);
    }
  };

  const submitCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) {
      return;
    }
    await runAction("run_command", { command: trimmed });
  };

  const isBusy = disabled || runningAction !== null;
  const isSandbox = workspace.runtime.provider === "sandbox";

  return (
    <section className="rounded-3xl border border-white/10 bg-card/60 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void runAction("status");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "status" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Refresh
        </button>
        {isSandbox ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              void runAction("sync_workspace");
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningAction === "sync_workspace" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <UploadCloud size={13} />
            )}
            Sync to Sandbox
          </button>
        ) : null}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void runAction("start_preview");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "start_preview" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} />
          )}
          Start Preview
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void runAction("stop_preview");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "stop_preview" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <SquareTerminal size={13} />
          )}
          Stop Preview
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void runAction("install_dependencies");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "install_dependencies" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Terminal size={13} />
          )}
          Install Deps
        </button>
        {isSandbox ? (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                void runAction("get_logs");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningAction === "get_logs" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ScrollText size={13} />
              )}
              Sandbox Logs
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                void runAction("verify_build");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningAction === "verify_build" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Hammer size={13} />
              )}
              Verify Build
            </button>
          </>
        ) : null}
      </div>

      <form onSubmit={(event) => void submitCommand(event)} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Run a workspace command, like npm run build"
          className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/50"
        />
        <button
          type="submit"
          disabled={isBusy || !command.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "run_command" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Terminal size={14} />
          )}
          Run Command
        </button>
      </form>

      {previewPid ? (
        <p className="mt-3 text-[10px] font-mono text-muted-foreground">
          Preview process: <span className="text-foreground">{previewPid}</span>
        </p>
      ) : null}

      {workspace.runtime.lastCommand ? (
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Last command:{" "}
          <span className="font-mono text-foreground">{workspace.runtime.lastCommand}</span>
        </p>
      ) : null}

      {workspace.runtime.lastOutput ? (
        <div className="mt-3 max-h-48 overflow-auto rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-relaxed whitespace-pre-wrap text-emerald-800 dark:text-emerald-300">
          {workspace.runtime.lastOutput}
        </div>
      ) : null}

      {workspace.runtime.lastError ? (
        <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
          {workspace.runtime.lastError}
        </div>
      ) : null}
    </section>
  );
}
