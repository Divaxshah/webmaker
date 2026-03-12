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
    <div className="h-full overflow-y-auto rounded-xl border border-[var(--wm-border)] bg-[var(--wm-panel)] p-3 font-mono text-xs">
      {rows.length === 0 ? (
        <p className="text-[var(--wm-muted)]">Console output appears here.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <p
              key={row.id}
              className={`whitespace-pre-wrap break-words ${
                row.level === "error"
                  ? "text-[#d59a8c]"
                  : row.level === "warn"
                    ? "text-[#dbc293]"
                    : "text-[#d8cebf]"
              }`}
            >
              [{row.level}] {row.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
