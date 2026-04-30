"use client";

/**
 * StackBlitz embed runs dev tooling inside its own UI; we do not pipe iframe console here.
 */
export function ConsoleView() {
  return (
    <div className="h-full overflow-y-auto bg-[#111111] p-6 font-mono text-[13px] leading-relaxed text-white/55">
      <p className="mb-3 font-semibold text-white/70">Console</p>
      <p className="mb-4">
        Logs and terminal output appear inside the StackBlitz preview above (WebContainers). Switch to
        the Preview tab and use StackBlitz&apos;s embedded devtools there.
      </p>
      <p className="text-white/35 text-[12px]">
        For runtime-backed previews (HTTPS iframe), this panel stays minimal — Webmaker does not capture
        cross-origin iframe logs.
      </p>
    </div>
  );
}
