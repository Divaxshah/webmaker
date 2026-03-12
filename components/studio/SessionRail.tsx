"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import type { Session } from "@/lib/types";

interface SessionRailProps {
  sessions: Session[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewSession: () => void;
}

const formatLabel = (session: Session): string => {
  const firstUserMessage = session.messages.find((message) => message.role === "user");
  if (firstUserMessage) {
    return firstUserMessage.content;
  }

  return session.currentProject.title;
};

export function SessionRail({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNewSession,
}: SessionRailProps) {
  return (
    <aside className="hidden w-[290px] shrink-0 border-r border-[var(--wm-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--wm-shell)_98%,transparent),color-mix(in_srgb,var(--wm-shell)_72%,transparent))] xl:flex xl:flex-col">
      <div className="px-5 py-5">
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--wm-text)] transition hover:text-[var(--wm-accent)]"
        >
          <Plus size={16} />
          New build session
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={`border-l pl-4 transition ${
                isActive ? "border-[var(--wm-accent)]" : "border-[var(--wm-border)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                className="block w-full text-left"
              >
                <div className="flex items-center gap-2">
                  {isActive && <Sparkles size={13} className="text-[var(--wm-accent)]" />}
                  <p className="truncate text-sm font-semibold text-[var(--wm-text)]">
                    {session.currentProject.title}
                  </p>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-6 text-[var(--wm-muted-soft)]">
                  {formatLabel(session)}
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-[var(--wm-muted)]">
                  {Object.keys(session.currentProject.files).length} files
                </p>
              </button>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDelete(session.id)}
                  className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--wm-muted)] transition hover:text-[var(--wm-text)]"
                >
                  <Trash2 size={12} />
                  Delete session
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
