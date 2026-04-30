"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GeneratedProject } from "@/lib/types";
import { getPreviewSessionKey } from "@/lib/preview-session-key";
import { getStackBlitzEmbedDefinition } from "@/lib/stackblitz-project";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

function waitPaintTwice(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

interface StackBlitzFrameProps {
  project: GeneratedProject;
  refreshKey?: number;
}

const PREVIEW_LOAD_HINT_MS = 120_000;

/**
 * Embeds a StackBlitz WebContainers project via `@stackblitz/sdk` (template `node`, Vite tree from bootstrap).
 */
export function StackBlitzFrame({ project, refreshKey = 0 }: StackBlitzFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const embedGenRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const mountId = useMemo(
    () =>
      `wm-sb-${getPreviewSessionKey(project).replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [project]
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const myGen = ++embedGenRef.current;
    let cancelled = false;
    setError(null);

    const run = async () => {
      try {
        await waitPaintTwice();
        if (cancelled || myGen !== embedGenRef.current) return;

        let target = containerRef.current;
        if (!target?.isConnected) return;

        const sdk = (await import("@stackblitz/sdk")).default;
        if (cancelled || myGen !== embedGenRef.current) return;

        target = containerRef.current;
        if (!target?.isConnected) return;

        const def = getStackBlitzEmbedDefinition(projectRef.current);
        target.replaceChildren();

        if (cancelled || myGen !== embedGenRef.current) return;
        if (!target.isConnected) return;

        await sdk.embedProject(
          target,
          {
            title: def.title,
            description: def.description,
            template: def.template,
            files: def.files,
          },
          {
            openFile: def.openFile,
            view: "preview",
            height: "100%",
          }
        );
      } catch (e) {
        if (!cancelled && myGen === embedGenRef.current) {
          setError(e instanceof Error ? e.message : "Failed to load StackBlitz preview.");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      containerRef.current?.replaceChildren();
    };
  }, [refreshKey, mountId]);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-[var(--wm-border)] bg-white dark:bg-zinc-900 p-1"
      style={{ height: "100%", minHeight: 0 }}
    >
      <style>{`
        .stackblitz-frame-root,
        .stackblitz-frame-root iframe {
          border-radius: 0 !important;
        }
      `}</style>
      <div
        id={mountId}
        ref={containerRef}
        className="stackblitz-frame-root flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ minHeight: 0 }}
      />

      {error ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center backdrop-blur-sm">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Try Refresh in the toolbar, or open Preview in a new tab. Large projects may exceed browser limits.
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface StackBlitzFrameWithRetryProps extends StackBlitzFrameProps {
  onRetryFullRemount?: () => void;
}

/** Same as StackBlitzFrame with optional timeout overlay + retry (parity with old Sandpack LivePreview). */
export function StackBlitzFrameWithRetry({
  project,
  refreshKey,
  onRetryFullRemount,
}: StackBlitzFrameWithRetryProps) {
  const [showTimeoutHint, setShowTimeoutHint] = useState(false);

  useEffect(() => {
    setShowTimeoutHint(false);
    const t = window.setTimeout(() => setShowTimeoutHint(true), PREVIEW_LOAD_HINT_MS);
    return () => window.clearTimeout(t);
  }, [refreshKey, project]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" style={{ height: "100%", minHeight: 0 }}>
      <StackBlitzFrame project={project} refreshKey={refreshKey} />
      {showTimeoutHint && onRetryFullRemount ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-none bg-background/95 p-6 text-center backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">
              Preview may still be installing dependencies. You can retry or open in a new tab.
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="default" size="sm" onClick={onRetryFullRemount} className="gap-2">
              <RefreshCw className="size-4" />
              Retry preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowTimeoutHint(false)} className="text-muted-foreground">
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
