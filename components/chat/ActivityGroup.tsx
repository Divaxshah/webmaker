"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Message } from "@/lib/types";
import { estimateTokenCount } from "@/lib/utils";
import { StatusIndicator } from "@/components/chat/StatusIndicator";

interface ActivityGroupProps {
  userMessage: Message;
  assistantMessage?: Message;
  streamingText: string;
  isLatest: boolean;
}

export function ActivityGroup({
  userMessage,
  assistantMessage,
  streamingText,
  isLatest,
}: ActivityGroupProps) {
  const [open, setOpen] = useState(() => isLatest);
  const [showSnippet, setShowSnippet] = useState(false);
  const snippetRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!snippetRef.current) {
      return;
    }

    snippetRef.current.scrollTop = snippetRef.current.scrollHeight;
  }, [streamingText]);

  const writingTokens = useMemo(
    () => estimateTokenCount(streamingText),
    [streamingText]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b border-[var(--wm-border)] pb-4"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-start gap-3 text-left"
      >
        <ChevronRight
          size={15}
          className={`mt-1 text-[var(--wm-muted)] transition ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 text-sm leading-7 text-[var(--wm-text)]">{userMessage.content}</p>
        </div>
      </button>

      {open && (
        <div className="space-y-3 pl-7 pt-3">
          {assistantMessage && (
            <>
              {(assistantMessage.status === "thinking" ||
                assistantMessage.status === "writing" ||
                assistantMessage.status === "done" ||
                assistantMessage.status === "error") && (
                <StatusIndicator status="thinking" />
              )}

              {(assistantMessage.status === "writing" ||
                assistantMessage.status === "done" ||
                assistantMessage.status === "error") && (
                <StatusIndicator
                  status="writing"
                  writingTokenCount={writingTokens || assistantMessage.tokenCount}
                />
              )}

              {assistantMessage.status === "done" && (
                <StatusIndicator
                  status="done"
                  tokenCount={assistantMessage.tokenCount}
                  latencyMs={assistantMessage.latencyMs}
                />
              )}

              {assistantMessage.status === "error" && (
                <StatusIndicator
                  status="error"
                  errorMessage={assistantMessage.content}
                />
              )}

              {(assistantMessage.status === "writing" ||
                (assistantMessage.status === "done" && assistantMessage.codeSnapshot)) && (
                <div className="border-l border-[var(--wm-border)] pl-4">
                  <button
                    type="button"
                    onClick={() => setShowSnippet((prev) => !prev)}
                    className="text-[11px] uppercase tracking-[0.22em] text-[var(--wm-muted)] transition hover:text-[var(--wm-text)]"
                  >
                    {showSnippet ? "Hide" : "Show"} streaming payload
                  </button>
                  {showSnippet && (
                    <pre
                      ref={snippetRef}
                      className="mt-3 max-h-32 overflow-y-auto font-mono text-[11px] leading-relaxed text-[#ded4c7]"
                    >
                      {streamingText || assistantMessage.codeSnapshot?.slice(-240)}
                    </pre>
                  )}
                </div>
              )}

              {assistantMessage.content && assistantMessage.status !== "error" && (
                <div className="text-sm leading-7 text-[var(--wm-muted-soft)]">
                  {assistantMessage.content}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
