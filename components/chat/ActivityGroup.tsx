"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  CheckCircle2,
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
import type { FileEditCounts } from "@/components/chat/StatusIndicator";
import { StatusIndicator } from "@/components/chat/StatusIndicator";

interface ActivityGroupProps {
  userMessage: Message;
  assistantMessage?: Message;
  streamingText: string;
  isLatest: boolean;
}

function countFileEdits(activities: AgentActivity[]): FileEditCounts {
  let created = 0;
  let deleted = 0;
  let edited = 0;
  for (const a of activities) {
    if (a.kind === "create") created += 1;
    else if (a.kind === "delete") deleted += 1;
    else if (a.kind === "edit" || a.kind === "rename") edited += 1;
  }
  return { created, deleted, edited };
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-chat text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className="my-3 p-3 rounded-lg bg-muted border border-border overflow-x-auto text-xs">
                <code {...props}>{children}</code>
              </pre>
            );
          }
          return (
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        h1: ({ children }) => <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
        a: ({ href, children }) => (
          <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ActivityGroup({
  userMessage,
  assistantMessage,
  streamingText,
  isLatest,
}: ActivityGroupProps) {
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);
  const snippetRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!snippetRef.current) return;
    snippetRef.current.scrollTop = snippetRef.current.scrollHeight;
  }, [streamingText]);

  const activities = assistantMessage?.activities ?? [];
  const latestActivity = activities[activities.length - 1];
  const fileEdits = countFileEdits(activities);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-w-0 space-y-3 overflow-hidden"
    >
      {/* User message: distinct user bubble */}
      <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 overflow-hidden">
        <p className="break-words text-sm font-medium leading-relaxed text-foreground">
          {userMessage.content}
        </p>
      </div>

      {/* Assistant: status, thinking trails, agent log, and final message */}
      {assistantMessage && (
        <div className="min-w-0 space-y-3 pl-4 overflow-hidden border-l-2 border-primary/30 bg-card/60 rounded-r-2xl py-2 pr-2">
          {assistantMessage.status === "thinking" && (
            <StatusIndicator status="thinking" activityCount={activities.length} />
          )}

          {(assistantMessage.status === "writing" ||
            assistantMessage.status === "done" ||
            assistantMessage.status === "cancelled") && (
            <>
              <StatusIndicator
                status={assistantMessage.status as "writing" | "done" | "cancelled"}
                activityCount={activities.length}
                currentLabel={latestActivity?.title}
                latencyMs={assistantMessage.latencyMs}
                fileEdits={fileEdits.created + fileEdits.deleted + fileEdits.edited > 0 ? fileEdits : undefined}
              />

              {/* Per-step one-liners, each expandable to show details */}
              <div className="space-y-0.5">
                {activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <AgentStepOneLiner
                      key={`${activity.id}-${index}`}
                      activity={activity}
                      index={index}
                      isExpanded={expandedStepIndex === index}
                      isLive={
                        assistantMessage.status === "writing" &&
                        index === activities.length - 1
                      }
                      onToggle={() =>
                        setExpandedStepIndex((prev) =>
                          prev === index ? null : index
                        )
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Waiting for the first streamed tool action.
                  </p>
                )}
              </div>

              {(assistantMessage.status === "writing" ||
                (assistantMessage.codeSnapshot && (assistantMessage.status === "done" || assistantMessage.status === "cancelled"))) && (
                <div>
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
            </>
          )}

          {assistantMessage.status === "error" && (
            <StatusIndicator status="error" errorMessage={assistantMessage.content} />
          )}

          {/* Final assistant reply (markdown) */}
          {assistantMessage.content && assistantMessage.status !== "error" && (
            <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <MarkdownContent content={assistantMessage.content} />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** One line per step; shows created/deleted/edited symbols; expandable for full details */
function AgentStepOneLiner({
  activity,
  index,
  isExpanded,
  isLive,
  onToggle,
}: {
  activity: AgentActivity;
  index: number;
  isExpanded: boolean;
  isLive: boolean;
  onToggle: () => void;
}) {
  const n = activity.targets?.length ?? (activity.kind === "create" || activity.kind === "delete" || activity.kind === "edit" || activity.kind === "rename" ? 1 : 0);
  const symbols: string[] = [];
  if (activity.kind === "create" && n > 0) symbols.push(`⊕${n}`);
  if (activity.kind === "delete" && n > 0) symbols.push(`⊖${n}`);
  if ((activity.kind === "edit" || activity.kind === "rename") && n > 0) symbols.push(`✎${n}`);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left text-xs text-foreground hover:text-primary transition py-1 rounded-md hover:bg-secondary/30 -mx-1 px-1"
      >
        <ChevronDown
          size={12}
          className={`shrink-0 text-muted-foreground transition ${isExpanded ? "rotate-180" : ""}`}
        />
        <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md border border-primary/15 bg-primary/10 text-primary">
          {renderActivityIcon(activity.kind)}
        </span>
        <span className="min-w-0 truncate font-medium">{activity.title}</span>
        {symbols.length > 0 && (
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {symbols.join(" ")}
          </span>
        )}
        {isLive && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <span className="h-1 w-1 rounded-full bg-primary" />
            Live
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 ml-7">
          <AgentStepCard activity={activity} isLive={isLive} />
        </div>
      )}
    </div>
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
