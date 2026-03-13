"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PenLine,
  Square,
} from "lucide-react";
import type { MessageStatus } from "@/lib/types";

export interface FileEditCounts {
  created: number;
  deleted: number;
  edited: number;
}

interface StatusIndicatorProps {
  status: MessageStatus;
  latencyMs?: number;
  errorMessage?: string;
  activityCount?: number;
  currentLabel?: string;
  fileEdits?: FileEditCounts;
}

function FileEditsLine({ fileEdits }: { fileEdits: FileEditCounts }) {
  const parts: string[] = [];
  if (fileEdits.created > 0) parts.push(`⊕${fileEdits.created}`);
  if (fileEdits.deleted > 0) parts.push(`⊖${fileEdits.deleted}`);
  if (fileEdits.edited > 0) parts.push(`✎${fileEdits.edited}`);
  if (parts.length === 0) return null;
  return (
    <span className="text-xs text-muted-foreground font-medium tabular-nums">
      {" "}
      {parts.join(" ")}
    </span>
  );
}

export function StatusIndicator({
  status,
  latencyMs,
  errorMessage,
  activityCount,
  currentLabel,
  fileEdits,
}: StatusIndicatorProps) {
  if (status === "thinking") {
    return (
      <div className="flex items-center gap-2 text-foreground">
        <motion.span
          className="h-2 w-2 rounded-full bg-primary"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
        <span className="text-xs">Preparing the agent workflow...</span>
      </div>
    );
  }

  if (status === "writing") {
    return (
      <div className="flex items-center gap-2 text-foreground flex-wrap">
        <motion.span
          className="h-2 w-2 rounded-full bg-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
        <span className="text-xs">{currentLabel ?? "Running agent actions..."}</span>
        {typeof activityCount === "number" && (
          <span className="text-xs text-muted-foreground">{activityCount} steps</span>
        )}
        {fileEdits && <FileEditsLine fileEdits={fileEdits} />}
        <PenLine size={12} className="text-muted-foreground" />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 text-foreground flex-wrap">
        <CheckCircle2 size={14} className="text-primary" />
        <span className="text-xs">
          {typeof activityCount === "number" ? `${activityCount} steps` : "Completed"}
          {latencyMs != null ? ` · ${(latencyMs / 1000).toFixed(1)}s` : ""}
        </span>
        {fileEdits && <FileEditsLine fileEdits={fileEdits} />}
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-amber-500 flex-wrap">
        <Square size={12} className="fill-current" />
        <span className="text-xs">
          Generation stopped
          {typeof activityCount === "number" ? ` after ${activityCount} steps` : ""}
        </span>
        {fileEdits && <FileEditsLine fileEdits={fileEdits} />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-destructive">
      <AlertCircle size={14} className="text-destructive" />
      <span className="truncate text-xs">
        {errorMessage ?? "Generation failed"}
      </span>
      <Loader2 size={12} className="animate-spin text-destructive" />
    </div>
  );
}
