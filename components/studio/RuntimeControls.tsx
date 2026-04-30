"use client";

import { Cloud, HardDrive } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectableRuntimeProviderMode } from "@/lib/runtime-config";
import type { WorkspaceSnapshot } from "@/lib/types";

interface RuntimeControlsProps {
  workspace?: WorkspaceSnapshot;
  selectedProvider?: SelectableRuntimeProviderMode;
  onProviderChange?: (provider: SelectableRuntimeProviderMode) => void;
}

/** Runtime messages only — provider/status live under the project title; preview refresh is in the Preview toolbar. */
export function RuntimeControls({
  workspace,
  selectedProvider = "local",
  onProviderChange,
}: RuntimeControlsProps) {
  if (!workspace && !onProviderChange) {
    return null;
  }

  const lastOutput = workspace?.runtime.lastOutput;
  const lastError = workspace?.runtime.lastError;
  const showPanel = Boolean(lastOutput || lastError);

  if (!lastOutput && !lastError) {
    return (
      <section className="rounded-3xl border border-white/10 bg-card/60 p-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Runtime Provider
            </p>
            <p className="text-sm font-medium text-foreground">
              Select the execution backend for runtime tools.
            </p>
          </div>
          <RuntimeProviderSelect
            value={selectedProvider}
            onChange={onProviderChange}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-card/60 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Runtime Provider
          </p>
          <p className="text-sm font-medium text-foreground">
            Select the execution backend for runtime tools.
          </p>
        </div>
        <RuntimeProviderSelect
          value={selectedProvider}
          onChange={onProviderChange}
        />
      </div>

      {lastOutput ? (
        <div className="max-h-48 overflow-auto rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-relaxed whitespace-pre-wrap text-emerald-800 dark:text-emerald-300">
          {lastOutput}
        </div>
      ) : null}

      {lastError ? (
        <div
          className={`rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive ${
            showPanel && lastOutput ? "mt-3" : ""
          }`}
        >
          {lastError}
        </div>
      ) : null}
    </section>
  );
}

function RuntimeProviderSelect({
  value,
  onChange,
}: {
  value: SelectableRuntimeProviderMode;
  onChange?: (provider: SelectableRuntimeProviderMode) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === "local" || nextValue === "cloudflare-sandbox") {
          onChange?.(nextValue);
        }
      }}
    >
      <SelectTrigger className="min-w-56 rounded-2xl border-white/10 bg-background/70 px-3 py-2">
        <SelectValue placeholder="Select provider" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="local">
          <HardDrive className="size-4" />
          Local Runtime
        </SelectItem>
        <SelectItem value="cloudflare-sandbox">
          <Cloud className="size-4" />
          Cloudflare Sandbox
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
