"use client";

import { SandpackPreview } from "@codesandbox/sandpack-react";
import { useSandpackErrors } from "@/hooks/useSandpackErrors";
import type { RuntimeErrorState } from "@/lib/types";

interface LivePreviewProps {
  onRuntimeError: (error: RuntimeErrorState) => void;
}

export function LivePreview({ onRuntimeError }: LivePreviewProps) {
  useSandpackErrors({ onRuntimeError });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--wm-border)] bg-[#1a1712] p-1"
      style={{ height: "100%", minHeight: 0 }}
    >
      <SandpackPreview
        showNavigator={false}
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        style={{
          height: "100%",
          minHeight: 0,
          flex: 1,
          borderRadius: 10,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      />
    </div>
  );
}
