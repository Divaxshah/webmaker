"use client";

import { useMemo } from "react";
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";
import type { GeneratedProject } from "@/lib/types";
import { getPreviewSandpackConfig } from "@/lib/download-bootstrap";

interface PreviewEmbedProps {
  project: GeneratedProject;
}

export function PreviewEmbed({ project }: PreviewEmbedProps) {
  const previewConfig = useMemo(() => getPreviewSandpackConfig(project), [project]);

  const sandpackKey = useMemo(
    () =>
      `${project.title}-${project.entry}-${Object.values(project.files).reduce(
        (sum, f) => sum + f.code.length,
        0
      )}`,
    [project]
  );

  return (
    <div className="preview-embed-wrapper rounded-none" style={{ width: "100vw", height: "100vh" }}>
      <style>{`
        .preview-embed-wrapper,
        .preview-embed-wrapper .sp-wrapper,
        .preview-embed-wrapper .sp-layout,
        .preview-embed-wrapper .sp-preview,
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
        .preview-embed-wrapper [class*="sp-"] {
          border-radius: 0 !important;
        }
      `}</style>
      <SandpackProvider
        key={sandpackKey}
        template="vite-react-ts"
        files={previewConfig.files}
        theme="light"
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
