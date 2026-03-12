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
import type { GeneratedProject } from "@/lib/types";

interface PreviewPanelProps {
  project: GeneratedProject;
  runtimeError: string | null;
  onDismissError: () => void;
  onFixError: () => void;
  onRuntimeError: (error: { message: string; code: string }) => void;
}

const theme = {
  ...defaultDark,
  colors: {
    ...defaultDark.colors,
    surface1: "#17140f",
    surface2: "#1d1913",
    surface3: "#262018",
    base: "#f1eadf",
    clickable: "#d5c6af",
    accent: "#a7773d",
    disabled: "#8d836f",
    error: "#cf7c69",
    errorSurface: "#2a1915",
  },
  syntax: {
    ...defaultDark.syntax,
    plain: "#f1eadf",
    keyword: "#d7c39f",
    string: "#b9c69c",
  },
};

export function PreviewPanel({
  project,
  runtimeError,
  onDismissError,
  onFixError,
  onRuntimeError,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [activeFile, setActiveFile] = useState(() => getProjectPrimaryFile(project));

  useEffect(() => {
    setActiveFile(getProjectPrimaryFile(project));
  }, [project]);

  const files = useMemo(() => projectToSandpackFiles(project), [project]);
  const sandpackKey = useMemo(
    () =>
      `${project.title}-${project.entry}-${Object.values(project.files).reduce(
        (sum, file) => sum + file.code.length,
        0
      )}`,
    [project]
  );

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-transparent p-0 lg:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--wm-border)] pb-3 lg:mb-5 lg:pb-4">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--wm-muted)]">
            Active project
          </p>
          <p className="mt-1 text-sm text-[var(--wm-text)]">
            {project.title} · {Object.keys(project.files).length} files
          </p>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--wm-shell)_96%,transparent),color-mix(in_srgb,var(--wm-bg)_92%,var(--wm-shell)))] lg:border lg:border-[var(--wm-border)]">
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
          <div className="absolute inset-0 overflow-hidden rounded-[1.75rem]">
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
                  className={`absolute inset-0 min-h-0 transition ${
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
                  className={`absolute inset-0 min-h-0 transition ${
                    activeTab === "code"
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <CodeViewer
                    project={project}
                    activeFile={activeFile}
                    onActiveFileChange={setActiveFile}
                  />
                </div>

                <div
                  className={`absolute inset-0 min-h-0 transition ${
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
        <ErrorBanner message={runtimeError} onDismiss={onDismissError} onFix={onFixError} />
      )}
    </section>
  );
}
