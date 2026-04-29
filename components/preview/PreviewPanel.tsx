"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  SandpackLayout,
  SandpackProvider,
  defaultDark,
} from "@codesandbox/sandpack-react";
import { ErrorBanner } from "@/components/preview/ErrorBanner";
import { LivePreview } from "@/components/preview/LivePreview";
import { CodeViewer } from "@/components/preview/CodeViewer";
import { ConsoleView } from "@/components/preview/ConsoleView";
import { TabBar, type PreviewTab } from "@/components/preview/TabBar";
import { getProjectPrimaryFile } from "@/lib/project";
import type { GeneratedProject, RuntimeErrorState, WorkspaceSnapshot } from "@/lib/types";
import { Cpu, ExternalLink, Link2, Loader2, AlertTriangle, RefreshCw, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getPreviewSandpackConfig } from "@/lib/download-bootstrap";

interface PreviewPanelProps {
  project: GeneratedProject;
  workspace?: WorkspaceSnapshot;
  runtimeError: RuntimeErrorState | null;
  isGenerating?: boolean;
  onDismissError: () => void;
  onFixError: () => void;
  onRuntimeError: (error: RuntimeErrorState) => void;
  onShareError: () => void;
  /** Push generated files to the Cloudflare Sandbox (same workspace as Install / Run). */
  onSyncToSandbox?: () => void | Promise<void>;
}

const theme = {
  ...defaultDark,
  colors: {
    ...defaultDark.colors,
    surface1: "#17140f",
    surface2: "#241505",
    surface3: "#2c1a07",
    base: "#f1eadf",
    clickable: "#d5c6af",
    accent: "#f97316",
    disabled: "#8d836f",
    error: "#cf7c69",
    errorSurface: "#2a1915",
  },
  syntax: {
    ...defaultDark.syntax,
    plain: "#f1eadf",
    keyword: "#fb923c",
    string: "#bef264",
  },
};

export function PreviewPanel({
  project,
  workspace,
  runtimeError,
  isGenerating,
  onDismissError,
  onFixError,
  onRuntimeError,
  onShareError,
  onSyncToSandbox,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [previewSource, setPreviewSource] = useState<"live" | "sandpack">("live");
  const [activeFile, setActiveFile] = useState(() => getProjectPrimaryFile(project));

  useEffect(() => {
    setActiveFile(getProjectPrimaryFile(project));
  }, [project]);

  useEffect(() => {
    if (runtimeError?.filePath && project.files[runtimeError.filePath]) {
      setActiveFile(runtimeError.filePath);
    }
  }, [project.files, runtimeError?.filePath]);

  const previewConfig = useMemo(
    () => getPreviewSandpackConfig(project),
    [project]
  );
  const sandpackKey = useMemo(
    () =>
      `${project.title}-${project.entry}-${Object.values(project.files).reduce(
        (sum, file) => sum + file.code.length,
        0
      )}`,
    [project]
  );

  const isStarterProject = project.title === "New Workspace" || project.title === "Webmaker Starter";

  const [openingPreview, setOpeningPreview] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const runtimePreviewUrl = workspace?.runtime.preview.url;
  const liveSandboxUrl =
    runtimePreviewUrl &&
    /^https?:\/\//i.test(runtimePreviewUrl.trim())
      ? runtimePreviewUrl.trim()
      : null;

  useEffect(() => {
    if (!liveSandboxUrl) {
      setPreviewSource("sandpack");
    }
  }, [liveSandboxUrl]);

  const retryPreview = useCallback(() => {
    setPreviewRefreshKey((k) => k + 1);
  }, []);

  const openPreview = useCallback(async () => {
    if (liveSandboxUrl) {
      window.open(liveSandboxUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setOpeningPreview(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const json = (await res.json()) as { id?: string; url?: string };
      if (json.id) {
        try {
          window.localStorage.setItem(`wm-preview-${json.id}`, JSON.stringify(project));
        } catch (e) {
          console.warn("Could not save preview to localStorage", e);
        }
      }
      if (json.url) {
        setPreviewUrl(json.url);
        window.open(json.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpeningPreview(false);
    }
  }, [project, liveSandboxUrl]);

  const copyPreviewLink = useCallback(async () => {
    if (liveSandboxUrl) {
      await navigator.clipboard.writeText(liveSandboxUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    let url = previewUrl;
    if (!url) {
      setOpeningPreview(true);
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project }),
        });
        const json = (await res.json()) as { id?: string; url?: string };
        if (json.id) {
          try {
            window.localStorage.setItem(`wm-preview-${json.id}`, JSON.stringify(project));
          } catch (e) {
            console.warn("Could not save preview to localStorage", e);
          }
        }
        if (json.url) {
          url = json.url;
          setPreviewUrl(json.url);
        }
      } finally {
        setOpeningPreview(false);
      }
    }
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [project, previewUrl, liveSandboxUrl]);

  if (isStarterProject) {
    if (isGenerating) {
      return (
        <div className="flex h-full w-full items-center justify-center p-8 bg-card/30 backdrop-blur-xl rounded-none border-2 border-border overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent animate-pulse" />
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center max-w-md p-12 relative z-10"
          >
            <div className="relative mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-4 rounded-full border border-primary/30 border-dashed"
              />
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 bg-primary/20 text-primary flex items-center justify-center rounded-2xl rotate-3 backdrop-blur-sm border border-primary/30 shadow-[0_0_30px_rgba(234,88,12,0.2)]"
              >
                <Loader2 className="w-10 h-10 animate-spin" />
              </motion.div>
            </div>
            <h2 className="font-display text-4xl tracking-tight font-bold text-foreground mb-4 leading-none">
              Synthesizing <br/><span className="text-primary italic">Architecture...</span>
            </h2>
            <div className="space-y-3 mt-2 text-sm text-muted-foreground font-medium">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 justify-center"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                Drafting components & styles
              </motion.p>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-card/30 backdrop-blur-xl rounded-none border-2 border-border">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center text-center max-w-md p-12"
        >
          <div className="w-20 h-20 bg-primary/10 text-primary flex items-center justify-center mb-8 rounded-2xl rotate-3">
            <Cpu className="w-10 h-10" />
          </div>
          <h2 className="font-display text-4xl tracking-tight font-bold text-foreground mb-4 leading-none">System <br/><span className="text-primary italic">Idle.</span></h2>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            Workspace is empty. Provide a prompt to the Studio Assistant to begin generation sequence.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-card/30 backdrop-blur-xl border-2 border-border rounded-none">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none">
      <div className="flex flex-wrap items-center justify-between gap-4 p-0 bg-background/50 backdrop-blur-md">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        <div className="text-right px-4 py-2 flex gap-3 items-center">
          <p className="font-bold text-foreground text-sm tracking-tight hidden sm:block">
            {project.title}
          </p>
          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-bold text-xs shadow-lg shadow-primary/20">
            {Object.keys(project.files).length} Files
          </div>
          {workspace && (
            <div className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {workspace.runtime.providerLabel ?? workspace.runtime.provider}
            </div>
          )}
          {liveSandboxUrl ? (
            <div className="flex rounded-full border border-border bg-secondary/50 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewSource("live")}
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                  previewSource === "live"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Live iframe
              </button>
              <button
                type="button"
                onClick={() => setPreviewSource("sandpack")}
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                  previewSource === "sandpack"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sandpack
              </button>
            </div>
          ) : null}
          {onSyncToSandbox ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void (async () => {
                  setSyncBusy(true);
                  try {
                    await onSyncToSandbox();
                  } finally {
                    setSyncBusy(false);
                  }
                })();
              }}
              disabled={syncBusy}
              title="Push generated files to the Cloudflare Sandbox"
              className="rounded-xl border-border bg-background hover:bg-secondary text-foreground h-8 gap-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em]"
            >
              {syncBusy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UploadCloud size={13} />
              )}
              <span className="hidden sm:inline">Sync to sandbox</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={retryPreview}
            title="Refresh preview (reload if blank or failed)"
            className="rounded-xl border-border bg-background hover:bg-secondary text-foreground h-8 w-8 p-0 transition-all shadow-sm"
          >
            <RefreshCw size={13} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copyPreviewLink()}
            disabled={openingPreview}
            title="Copy sharable preview link"
            className="rounded-xl border-border bg-background hover:bg-secondary text-foreground h-8 w-8 p-0 transition-all shadow-sm"
          >
            {openingPreview ? (
              <Loader2 size={13} className="animate-spin" />
            ) : copied ? (
              <span className="text-[10px] font-black text-green-500">✓</span>
            ) : (
              <Link2 size={13} />
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => void openPreview()}
            disabled={openingPreview}
            title="Open preview in new tab"
            className="rounded-xl bg-primary text-primary-foreground h-8 px-3 text-xs font-bold transition-all shadow-lg shadow-primary/20 gap-1.5"
          >
            {openingPreview ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ExternalLink size={13} />
            )}
            <span className="hidden sm:inline">Preview</span>
          </Button>
        </div>
      </div>

      {runtimePreviewUrl ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-y border-emerald-500/20 text-emerald-700 dark:text-emerald-400/90 text-xs">
          <Link2 className="size-3.5 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Runtime preview available: {runtimePreviewUrl}
          </p>
        </div>
      ) : null}

      {!liveSandboxUrl ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-y border-amber-500/20 text-amber-700 dark:text-amber-400/90 text-xs">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Preview is in beta — you may see some text in the background. If you see a white screen or raw code, use the Refresh button above to reload. For the full experience, download the ZIP from the Code tab and run it locally.
          </p>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col bg-background/50 preview-panel-wrapper rounded-none overflow-hidden">
        <style>{`
          .preview-panel-wrapper .sp-wrapper,
          .preview-panel-wrapper .sp-layout,
          .preview-panel-wrapper .sp-preview,
          .preview-panel-wrapper .sp-preview-container,
          .preview-panel-wrapper .sp-preview-iframe,
          .preview-panel-wrapper iframe {
            height: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
          }
          .preview-panel-wrapper [class*="sp-"] {
            border-radius: 0 !important;
          }
        `}</style>
        <SandpackProvider
          key={`${sandpackKey}-${previewRefreshKey}`}
          template="vite-react-ts"
          files={previewConfig.files}
          theme={theme}
          customSetup={{
            dependencies: previewConfig.dependencies,
            devDependencies: previewConfig.devDependencies,
            entry: previewConfig.entry,
          }}
          options={{
            autorun: true,
            autoReload: true,
          }}
        >
          <div className="absolute inset-0">
            <SandpackLayout
              style={{
                height: "100%",
                minHeight: 0,
                border: "none",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
                background: "transparent",
              }}
            >
              <div className="relative min-h-0 flex-1">
                <div
                  className={`absolute inset-0 min-h-0 transition-opacity duration-300 ${
                    activeTab === "preview"
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <div className="flex h-full min-h-0 flex-col">
                    {liveSandboxUrl && previewSource === "live" ? (
                      <iframe
                        key={`${liveSandboxUrl}-${previewRefreshKey}`}
                        title="Sandbox live preview"
                        src={liveSandboxUrl}
                        className="h-full min-h-0 w-full flex-1 border-0 bg-background"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      />
                    ) : (
                      <LivePreview
                        onRuntimeError={onRuntimeError}
                        onRetryFullRemount={retryPreview}
                      />
                    )}
                  </div>
                </div>

                <div
                  className={`absolute inset-0 min-h-0 transition-opacity duration-300 ${
                    activeTab === "code"
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <CodeViewer
                    project={project}
                    activeFile={activeFile}
                    runtimeError={runtimeError}
                    onActiveFileChange={setActiveFile}
                    onShareError={onShareError}
                  />
                </div>

                <div
                  className={`absolute inset-0 min-h-0 transition-opacity duration-300 ${
                    activeTab === "console"
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <ConsoleView />
                </div>
              </div>
            </SandpackLayout>
          </div>
        </SandpackProvider>
      </div>

      {runtimeError && activeTab === "preview" && (
        <ErrorBanner
          error={runtimeError}
          onDismiss={onDismissError}
          onOpenFile={() => {
            if (runtimeError.filePath && project.files[runtimeError.filePath]) {
              setActiveFile(runtimeError.filePath);
              setActiveTab("code");
            }
          }}
          onFix={onFixError}
          onShare={onShareError}
        />
      )}
      </div>
    </section>
  );
}
