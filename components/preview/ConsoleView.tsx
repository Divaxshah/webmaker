"use client";

import { useMemo } from "react";
import { useSandpackConsole } from "@codesandbox/sandpack-react";

export function ConsoleView() {
  const { logs } = useSandpackConsole({
    resetOnPreviewRestart: false,
    showSyntaxError: true,
    maxMessageCount: 250,
  });

  const rows = useMemo(() => {
    return logs.map((entry) => ({
      id: entry.id,
      level: entry.method,
      text: (entry.data ?? [])
        .map((item) =>
          typeof item === "string" ? item : JSON.stringify(item, null, 0)
        )
        .join(" "),
    }));
  }, [logs]);

  return (
    <div className="h-full overflow-y-auto bg-[#111111] p-6 font-mono text-[12px] scrollbar-thin">
      {rows.length === 0 ? (
        <p className="text-white/20 italic">Console output appears here...</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`whitespace-pre-wrap break-words p-2 rounded-lg ${
                row.level === "error"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : row.level === "warn"
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : "text-white/60 border border-white/5"
              }`}
            >
              <span className="opacity-40 mr-2">[{row.level}]</span>
              {row.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
