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
import {
  getProjectPrimaryFile,
  projectToSandpackFilesWithPreviewReset,
} from "@/lib/project";
import type { GeneratedProject, RuntimeErrorState } from "@/lib/types";
import { Cpu, ExternalLink, Link2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface PreviewPanelProps {
  project: GeneratedProject;
  runtimeError: RuntimeErrorState | null;
  onDismissError: () => void;
  onFixError: () => void;
  onRuntimeError: (error: RuntimeErrorState) => void;
  onShareError: () => void;
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
  runtimeError,
  onDismissError,
  onFixError,
  onRuntimeError,
  onShareError,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [activeFile, setActiveFile] = useState(() => getProjectPrimaryFile(project));

  useEffect(() => {
    setActiveFile(getProjectPrimaryFile(project));
  }, [project]);

  useEffect(() => {
    if (runtimeError?.filePath && project.files[runtimeError.filePath]) {
      setActiveFile(runtimeError.filePath);
    }
  }, [project.files, runtimeError?.filePath]);

  const files = useMemo(
    () => projectToSandpackFilesWithPreviewReset(project),
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

  const isStarterProject = project.title === "New Workspace";

  const [openingPreview, setOpeningPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openPreview = useCallback(async () => {
    setOpeningPreview(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        setPreviewUrl(json.url);
        window.open(json.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpeningPreview(false);
    }
  }, [project]);

  const copyPreviewLink = useCallback(async () => {
    let url = previewUrl;
    if (!url) {
      setOpeningPreview(true);
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project }),
        });
        const json = (await res.json()) as { url?: string };
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
  }, [project, previewUrl]);

  if (isStarterProject) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-card/30 backdrop-blur-xl rounded-[2.5rem] border-2 border-border">
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
    <section className="relative flex h-full min-h-0 flex-col bg-card/30 backdrop-blur-xl border-2 border-border rounded-[2.5rem]">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.5rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 p-0 bg-background/50 backdrop-blur-md">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        <div className="text-right px-4 py-2 flex gap-3 items-center">
          <p className="font-bold text-foreground text-sm tracking-tight hidden sm:block">
            {project.title}
          </p>
          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-bold text-xs shadow-lg shadow-primary/20">
            {Object.keys(project.files).length} Files
          </div>
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

      <div className="relative flex min-h-0 flex-1 flex-col bg-background/50 preview-panel-wrapper">
        <style>{`
          .preview-panel-wrapper .sp-wrapper,
          .preview-panel-wrapper .sp-layout,
          .preview-panel-wrapper .sp-preview-container,
          .preview-panel-wrapper .sp-preview-iframe,
          .preview-panel-wrapper iframe {
            height: 100% !important;
            width: 100% !important;
          }
        `}</style>
        <SandpackProvider
          key={sandpackKey}
          template="react-ts"
          files={files}
          theme={theme}
          customSetup={{
            dependencies: project.dependencies,
            entry: project.entry,
          }}
          options={{
            externalResources: [
              "data:application/javascript;charset=utf-8,window.tailwind%3D%7Bconfig%3A%7BdarkMode%3A%22class%22%7D%7D%3B",
              "https://cdn.tailwindcss.com",
            ],
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
                    <LivePreview onRuntimeError={onRuntimeError} />
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
