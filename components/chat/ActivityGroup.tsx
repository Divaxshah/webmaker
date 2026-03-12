"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  FileSearch2,
  PencilLine,
  ScanSearch,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type { AgentActivity, Message } from "@/lib/types";
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

  const activities = assistantMessage?.activities ?? [];
  const latestActivity = activities[activities.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-w-0 p-4 rounded-2xl bg-secondary/20 hover:bg-secondary/40 transition-colors overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full min-w-0 items-start gap-3 text-left"
      >
        <ChevronRight
          size={15}
          className={`mt-1.5 shrink-0 text-muted-foreground transition ${open ? "rotate-90 text-primary" : ""}`}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="line-clamp-3 break-words text-sm font-medium leading-relaxed text-foreground">{userMessage.content}</p>
        </div>
      </button>

      {open && (
        <div className="min-w-0 space-y-4 pl-7 pt-4 overflow-hidden">
          {assistantMessage && (
            <>
              {assistantMessage.status === "thinking" && (
                <StatusIndicator
                  status="thinking"
                  activityCount={activities.length}
                />
              )}

              {assistantMessage.status === "writing" && (
                <StatusIndicator
                  status="writing"
                  activityCount={activities.length}
                  currentLabel={latestActivity?.title}
                  writingTokenCount={writingTokens || assistantMessage.tokenCount}
                />
              )}

              {assistantMessage.status === "done" && (
                <StatusIndicator
                  status="done"
                  activityCount={activities.length}
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

              {assistantMessage.status === "cancelled" && (
                <StatusIndicator
                  status="cancelled"
                  activityCount={activities.length}
                  tokenCount={assistantMessage.tokenCount}
                />
              )}

              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                {activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <AgentStepCard
                      key={`${activity.id}-${index}`}
                      activity={activity}
                      isLive={
                        assistantMessage.status === "writing" &&
                        index === activities.length - 1
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                      Agent timeline
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Waiting for the first streamed tool action.
                    </p>
                  </div>
                )}
              </div>

              {(assistantMessage.status === "writing" ||
                ((assistantMessage.status === "done" ||
                  assistantMessage.status === "cancelled") &&
                  assistantMessage.codeSnapshot)) && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <button
                    type="button"
                    onClick={() => setShowSnippet((prev) => !prev)}
                    className="text-[10px] font-bold text-muted-foreground/60 transition hover:text-primary"
                  >
                    {showSnippet ? "Hide" : "Show"} Agent Log
                  </button>
                  {showSnippet && (
                    <pre
                      ref={snippetRef}
                      className="mt-3 p-4 rounded-xl bg-card border border-border max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed text-muted-foreground"
                    >
                      {streamingText || assistantMessage.codeSnapshot?.slice(-240)}
                    </pre>
                  )}
                </div>
              )}

              {assistantMessage.content && assistantMessage.status !== "error" && (
                <div className="min-w-0 break-words text-sm leading-relaxed text-muted-foreground font-medium">
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

function AgentStepCard({
  activity,
  isLive,
}: {
  activity: AgentActivity;
  isLive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
          {renderActivityIcon(activity.kind)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-none text-foreground">
              {activity.title}
            </p>
            {activity.tool && (
              <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                {activity.tool}
              </span>
            )}
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Live
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {activity.detail}
          </p>
          {activity.targets && activity.targets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activity.targets.map((target) => (
                <span
                  key={target}
                  className="rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  {target}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderActivityIcon(kind: AgentActivity["kind"]) {
  switch (kind) {
    case "inspect":
      return <ScanSearch size={16} />;
    case "search":
      return <Search size={16} />;
    case "read":
      return <FileSearch2 size={16} />;
    case "edit":
      return <PencilLine size={16} />;
    case "create":
      return <FilePlus2 size={16} />;
    case "delete":
      return <Trash2 size={16} />;
    case "rename":
      return <Wand2 size={16} />;
    case "verify":
    case "complete":
      return <CheckCircle2 size={16} />;
    case "plan":
    default:
      return <Sparkles size={16} />;
  }
}
