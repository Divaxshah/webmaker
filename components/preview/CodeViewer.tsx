"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileCode2 } from "lucide-react";
import { getProjectFilePaths } from "@/lib/project";
import type { GeneratedProject } from "@/lib/types";
import { downloadProjectBundle, openProjectInStackBlitz } from "@/lib/utils";

interface CodeViewerProps {
  project: GeneratedProject;
  activeFile: string;
  onActiveFileChange: (path: string) => void;
}

export function CodeViewer({
  project,
  activeFile,
  onActiveFileChange,
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const files = useMemo(() => getProjectFilePaths(project), [project]);
  const activeFileContents = project.files[activeFile]?.code ?? "";

  const copyCode = async () => {
    await navigator.clipboard.writeText(activeFileContents.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--wm-border)] pb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--wm-muted)]">
            Project files
          </p>
          <p className="mt-1 text-sm text-[var(--wm-text)]">{project.title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--wm-text)]">
          <button type="button" onClick={copyCode} className="transition hover:text-[var(--wm-accent)]">
            {copied ? "Copied file" : "Copy file"}
          </button>
          <button
            type="button"
            onClick={() => void downloadProjectBundle(project)}
            className="transition hover:text-[var(--wm-accent)]"
          >
            Download zip
          </button>
          <button
            type="button"
            onClick={() => openProjectInStackBlitz(project)}
            className="inline-flex items-center gap-1 transition hover:text-[var(--wm-accent)]"
          >
            <ExternalLink size={12} />
            StackBlitz
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-r border-[var(--wm-border)] pr-3">
          <div className="space-y-2">
            {files.map((path) => {
              const depth = Math.max(path.split("/").length - 2, 0);
              const isActive = path === activeFile;
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => onActiveFileChange(path)}
                  className={`flex w-full items-center gap-2 text-left text-xs transition ${
                    isActive
                      ? "text-[var(--wm-text)]"
                      : "text-[var(--wm-muted)] hover:text-[var(--wm-text)]"
                  }`}
                  style={{ paddingLeft: `${depth * 12}px` }}
                >
                  <FileCode2 size={13} className={isActive ? "text-[var(--wm-accent)]" : ""} />
                  <span className="truncate">{path.replace(/^\//, "")}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">
          <div className="border-b border-[var(--wm-border)] pb-2 text-xs text-[var(--wm-muted)]">
            {activeFile.replace(/^\//, "")}
          </div>
          <pre className="h-full overflow-auto py-4 font-mono text-[12px] leading-6 text-[#ded4c7]">
            <code>{activeFileContents}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
