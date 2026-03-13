"use client";

import { useEffect, useState } from "react";
import { SandpackPreview } from "@codesandbox/sandpack-react";
import { useSandpackErrors } from "@/hooks/useSandpackErrors";
import type { RuntimeErrorState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

const PREVIEW_LOAD_TIMEOUT_MS = 140000; /* 2 min 20 sec (was 20s; +2 min so overlay doesn’t show while preview is still loading) */

interface LivePreviewProps {
  onRuntimeError: (error: RuntimeErrorState) => void;
  onRetryFullRemount?: () => void;
}

export function LivePreview({ onRuntimeError, onRetryFullRemount }: LivePreviewProps) {
  useSandpackErrors({ onRuntimeError });
  const [showTimeoutHint, setShowTimeoutHint] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setShowTimeoutHint(true);
    }, PREVIEW_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-[var(--wm-border)] bg-white dark:bg-zinc-900 p-1"
      style={{ height: "100%", minHeight: 0 }}
    >
      <style>{`
        .live-preview-inner,
        .live-preview-inner *,
        .live-preview-inner *::before,
        .live-preview-inner *::after {
          border-radius: 0 !important;
        }
      `}</style>
      <div className="live-preview-inner flex min-h-0 flex-1 overflow-hidden rounded-none" style={{ minHeight: 0 }}>
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          style={{
            height: "100%",
            minHeight: 0,
            flex: 1,
            borderRadius: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        />
      </div>
      {showTimeoutHint && onRetryFullRemount && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-none bg-background/95 p-6 text-center backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">
              Preview may have failed to load. The preview server can be temporarily unavailable.
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Click below to get a fresh preview, or use the Refresh button in the toolbar. You can also open the preview in a new tab.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onRetryFullRemount}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Retry preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTimeoutHint(false)}
              className="text-muted-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
