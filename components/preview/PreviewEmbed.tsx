"use client";

import { useMemo } from "react";
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";
import { projectToSandpackFilesWithPreviewReset } from "@/lib/project";
import type { GeneratedProject } from "@/lib/types";

interface PreviewEmbedProps {
  project: GeneratedProject;
}

export function PreviewEmbed({ project }: PreviewEmbedProps) {
  const files = useMemo(() => projectToSandpackFilesWithPreviewReset(project), [project]);

  const sandpackKey = useMemo(
    () =>
      `${project.title}-${project.entry}-${Object.values(project.files).reduce(
        (sum, f) => sum + f.code.length,
        0
      )}`,
    [project]
  );

  return (
    <div className="preview-embed-wrapper" style={{ width: "100vw", height: "100vh" }}>
      <style>{`
        .preview-embed-wrapper,
        .preview-embed-wrapper .sp-wrapper,
        .preview-embed-wrapper .sp-layout,
        .preview-embed-wrapper .sp-preview-container,
        .preview-embed-wrapper .sp-preview-iframe,
        .preview-embed-wrapper iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 100vh !important;
          border: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      <SandpackProvider
        key={sandpackKey}
        template="react-ts"
        files={files}
        theme="light"
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
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            borderRadius: 0,
          }}
        />
      </SandpackProvider>
    </div>
  );
}
