"use client";

import { motion } from "framer-motion";
import { FolderTree, Plus, WandSparkles } from "lucide-react";
import { LUMINO_MODELS, type LuminoModelId } from "@/lib/models";
import type { Message } from "@/lib/types";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageFeed } from "@/components/chat/MessageFeed";
import { Logo } from "@/components/ui/Logo";

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  streamingText: string;
  lastPrompt: string;
  selectedModelId: LuminoModelId;
  projectTitle: string;
  projectSummary: string;
  fileCount: number;
  onModelChange: (modelId: LuminoModelId) => void;
  onSubmit: (prompt: string) => void;
  onNewSession: () => void;
}

export function ChatPanel({
  messages,
  isGenerating,
  streamingText,
  lastPrompt,
  selectedModelId,
  projectTitle,
  projectSummary,
  fileCount,
  onModelChange,
  onSubmit,
  onNewSession,
}: ChatPanelProps) {
  return (
    <section className="relative flex h-full min-h-0 flex-col border-r border-[var(--wm-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--wm-shell)_98%,transparent),color-mix(in_srgb,var(--wm-shell)_72%,transparent))]">
      <header className="relative border-b border-[var(--wm-border)] px-4 py-4 lg:px-5 lg:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <Logo isGenerating={isGenerating} />
            <label className="sr-only" htmlFor="model-select">
              Model
            </label>
            <select
              id="model-select"
              value={selectedModelId}
              onChange={(event) => onModelChange(event.target.value as LuminoModelId)}
              className="w-full max-w-[250px] border-b border-[var(--wm-border)] bg-transparent px-0 py-2 text-[11px] uppercase tracking-[0.24em] text-[var(--wm-text)] outline-none"
            >
              {LUMINO_MODELS.map((model) => (
                <option key={model.id} value={model.id} className="bg-[var(--wm-shell)]">
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onNewSession}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--wm-text)] transition hover:text-[var(--wm-accent)]"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 border-l border-[var(--wm-accent)] pl-4"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.24em] text-[var(--wm-muted)]">
            <WandSparkles size={12} className="text-[var(--wm-accent)]" />
            Active build
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-[var(--wm-text)]">{projectTitle}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--wm-muted-soft)]">{projectSummary}</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[var(--wm-muted)]">
              <FolderTree size={13} className="text-[var(--wm-accent)]" />
              {fileCount} files
            </div>
          </div>
        </motion.div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-2 py-3 lg:px-4 lg:py-4">
        <MessageFeed
          messages={messages}
          streamingText={streamingText}
          onSuggestionPick={onSubmit}
        />
      </div>

      <div className="border-t border-[var(--wm-border)] p-3 lg:p-4">
        <ChatInput isGenerating={isGenerating} lastPrompt={lastPrompt} onSubmit={onSubmit} />
      </div>
    </section>
  );
}
