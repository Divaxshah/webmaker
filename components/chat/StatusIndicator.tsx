"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, PenLine } from "lucide-react";
import type { MessageStatus } from "@/lib/types";

interface StatusIndicatorProps {
  status: MessageStatus;
  tokenCount?: number;
  latencyMs?: number;
  writingTokenCount?: number;
  errorMessage?: string;
}

export function StatusIndicator({
  status,
  tokenCount,
  latencyMs,
  writingTokenCount,
  errorMessage,
}: StatusIndicatorProps) {
  if (status === "thinking") {
    return (
      <div className="flex items-center gap-2 text-[#dbc293]">
        <motion.span
          className="h-2 w-2 rounded-full bg-[#b58547]"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
        <span className="text-xs">Planning file structure...</span>
      </div>
    );
  }

  if (status === "writing") {
    return (
      <div className="flex items-center gap-2 text-[#c4b8a2]">
        <motion.span
          className="h-2 w-2 rounded-full bg-[#8f7f65]"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
        <span className="text-xs">Generating project files...</span>
        <span className="text-xs text-[#aea28f]">
          ~{writingTokenCount ?? 0} tokens
        </span>
        <PenLine size={12} className="text-[#96886f]" />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 text-[#bfcda8]">
        <CheckCircle2 size={14} className="text-[#8ea56d]" />
        <span className="text-xs">
          ~{tokenCount ?? 0} tokens {latencyMs ? `· ${latencyMs}ms` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[#d8b0a6]">
      <AlertCircle size={14} className="text-[#c06d5b]" />
      <span className="truncate text-xs">
        {errorMessage ?? "Generation failed"}
      </span>
      <Loader2 size={12} className="animate-spin text-[#c06d5b]" />
    </div>
  );
}
