"use client";

import { useMemo } from "react";
import type { GeneratedProject } from "@/lib/types";
import { StackBlitzFrame } from "@/components/preview/StackBlitzFrame";
import { getPreviewSessionKey } from "@/lib/preview-session-key";

interface PreviewEmbedProps {
  project: GeneratedProject;
}

export function PreviewEmbed({ project }: PreviewEmbedProps) {
  const sessionKey = useMemo(() => getPreviewSessionKey(project), [project]);

  return (
    <div className="preview-embed-wrapper rounded-none" style={{ width: "100vw", height: "100vh" }}>
      <style>{`
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
      <StackBlitzFrame key={sessionKey} project={project} refreshKey={0} />
    </div>
  );
}
