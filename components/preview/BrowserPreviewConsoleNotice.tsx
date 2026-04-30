"use client";

/** When preview runs as an external iframe, Sandpack console hooks are not mounted. */
export function BrowserPreviewConsoleNotice() {
  return (
    <div className="h-full overflow-y-auto bg-[#111111] p-6 font-mono text-[13px] leading-relaxed text-white/45">
      <p>Console unavailable for this preview mode.</p>
    </div>
  );
}
