"use client";

import { useEffect, useMemo, useState } from "react";
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
  projectToSandpackFiles,
} from "@/lib/project";
import type { GeneratedProject, RuntimeErrorState } from "@/lib/types";
import { Cpu } from "lucide-react";
import { motion } from "framer-motion";

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

  const files = useMemo(() => projectToSandpackFiles(project), [project]);
  const sandpackKey = useMemo(
    () =>
      `${project.title}-${project.entry}-${Object.values(project.files).reduce(
        (sum, file) => sum + file.code.length,
        0
      )}`,
    [project]
  );

  const isStarterProject = project.title === "New Workspace";

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
        <div className="text-right px-6 py-2 flex gap-6 items-center">
          <div className="flex flex-col items-end justify-center">
            <p className="font-bold text-foreground text-sm tracking-tight">
              {project.title}
            </p>
          </div>
          <div className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full font-bold text-xs shadow-lg shadow-primary/20">
            {Object.keys(project.files).length} Files
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col bg-background/50">
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
            externalResources: ["https://cdn.tailwindcss.com"],
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
