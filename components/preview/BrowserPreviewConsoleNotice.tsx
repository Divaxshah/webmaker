"use client";

/** External HTTPS iframe preview: logs stay inside the remote origin; Webmaker cannot stream them here. */
export function BrowserPreviewConsoleNotice() {
  return (
    <div className="h-full overflow-y-auto bg-[#111111] p-6 font-mono text-[13px] leading-relaxed text-white/45">
      <p>Console unavailable for this preview mode (cross-origin iframe).</p>
    </div>
  );
}
