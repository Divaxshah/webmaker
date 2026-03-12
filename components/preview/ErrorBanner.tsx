"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onFix: () => void;
}

export function ErrorBanner({ message, onDismiss, onFix }: ErrorBannerProps) {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-30 rounded-2xl border border-[#7a4335] bg-[#2a1915] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#d8b0a6]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#ecd5cf]">
            Runtime error
          </p>
          <p className="mt-1 truncate text-xs text-[#d8b0a6]">{message}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-[#815244] px-2 py-1 text-xs text-[#ecd5cf] transition hover:bg-[#3a231d]"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onFix}
            className="rounded-lg border border-[#8f642f] bg-[#a7773d] px-2 py-1 text-xs font-semibold text-[#f8f2e8] transition hover:bg-[#8f642f]"
          >
            Fix project
          </button>
        </div>
      </div>
    </div>
  );
}
