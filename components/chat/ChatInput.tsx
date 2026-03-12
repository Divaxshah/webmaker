"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

interface ChatInputProps {
  isGenerating: boolean;
  lastPrompt: string;
  onSubmit: (prompt: string) => void;
}

export function ChatInput({ isGenerating, lastPrompt, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const next = Math.min(textarea.scrollHeight, 24 * 8);
    textarea.style.height = `${Math.max(next, 24 * 3)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) {
      return;
    }

    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="border-t border-[var(--wm-border)] pt-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }

          if (event.key === "ArrowUp" && !value && lastPrompt) {
            event.preventDefault();
            setValue(lastPrompt);
          }
        }}
        placeholder="Describe the frontend you want: landing page, app shell, pricing, privacy, terms, dashboards, flows..."
        disabled={isGenerating}
        rows={3}
        className="w-full resize-none bg-transparent px-0 py-0 text-sm font-medium leading-7 text-[var(--wm-text)] outline-none placeholder:text-[var(--wm-muted)] disabled:cursor-not-allowed"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--wm-muted)]">
          Shift+Enter for newline
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={isGenerating || !value.trim()}
          className="theme-toggle inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[var(--wm-text)] transition disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Submit prompt"
        >
          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
        </button>
      </div>
    </div>
  );
}
