"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { SessionRail } from "@/components/studio/SessionRail";
import { SessionStrip } from "@/components/studio/SessionStrip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ResizablePanel } from "@/components/ui/ResizablePanel";
import { useGeneration } from "@/hooks/useGeneration";
import type { LuminoModelId } from "@/lib/models";
import {
  getActiveSession,
  getActiveSessionMessages,
  getActiveSessionProject,
  useAppStore,
} from "@/lib/store";

type MobileTab = "chat" | "workspace";

export function StudioPage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const { generate } = useGeneration();
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const streamingText = useAppStore((state) => state.streamingText);
  const lastPrompt = useAppStore((state) => state.lastPrompt);
  const selectedModelId = useAppStore((state) => state.selectedModelId);
  const runtimeError = useAppStore((state) => state.runtimeError);

  const messages = useAppStore(getActiveSessionMessages);
  const project = useAppStore(getActiveSessionProject);
  const activeSession = useAppStore(getActiveSession);

  const deleteSession = useAppStore((state) => state.deleteSession);
  const setRuntimeError = useAppStore((state) => state.setRuntimeError);
  const setSelectedModelId = useAppStore((state) => state.setSelectedModelId);
  const setActiveSessionId = useAppStore((state) => state.setActiveSessionId);
  const newSession = useAppStore((state) => state.newSession);

  const fixPrompt = useMemo(() => {
    if (!runtimeError?.message) {
      return "";
    }

    return `Fix this runtime error across the current project: ${runtimeError.message}`;
  }, [runtimeError?.message]);

  const submitPrompt = async (prompt: string) => {
    setMobileTab("workspace");
    await generate({ prompt, includeCurrentProject: true });
  };

  const fixError = async () => {
    if (!fixPrompt) {
      return;
    }

    await generate({
      prompt: fixPrompt,
      includeCurrentProject: true,
    });
  };

  const createSession = () => {
    newSession();
    setMobileTab("chat");
  };

  const removeSession = (id: string) => {
    deleteSession(id);
    setMobileTab("chat");
  };

  const chatPanel = (
    <ChatPanel
      messages={messages}
      isGenerating={isGenerating}
      streamingText={streamingText}
      lastPrompt={lastPrompt}
      selectedModelId={selectedModelId}
      projectTitle={project.title}
      projectSummary={project.summary}
      fileCount={Object.keys(project.files).length}
      onModelChange={(modelId: LuminoModelId) => setSelectedModelId(modelId)}
      onSubmit={submitPrompt}
      onNewSession={createSession}
    />
  );

  const previewPanel = (
    <PreviewPanel
      project={project}
      runtimeError={runtimeError?.message ?? null}
      onDismissError={() => setRuntimeError(null)}
      onFixError={fixError}
      onRuntimeError={(error) => {
        setRuntimeError({
          message: error.message,
          code: error.code,
          timestamp: Date.now(),
        });
      }}
    />
  );

  return (
    <main className="studio-shell min-h-dvh w-full overflow-x-hidden">
      <div className="relative z-10 flex min-h-dvh w-full flex-col lg:h-dvh">
        <div className="border-b border-[var(--wm-border)] bg-[var(--wm-topbar)] px-3 py-3 backdrop-blur-xl sm:px-4">
          <div className="mx-auto flex w-full max-w-[1920px] items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--wm-muted)]">
                Webmaker Studio
              </p>
              <h1 className="font-display mt-1 text-2xl font-semibold text-[var(--wm-text)] sm:text-[2rem]">
                Prompt to complete frontend product
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden items-center gap-2 text-xs text-[var(--wm-muted)] md:flex">
                <Sparkles size={14} className="text-[var(--wm-accent)]" />
                {isGenerating ? "Generating project bundle" : "Frontend-only mode"}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col p-2 sm:p-4 lg:min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative flex flex-1 flex-col overflow-visible lg:min-h-0 lg:flex-row lg:overflow-hidden"
          >
            <SessionRail
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={(id) => {
                setActiveSessionId(id);
                setMobileTab("chat");
              }}
              onDelete={removeSession}
              onNewSession={createSession}
            />

            <div className="studio-stage relative flex flex-1 flex-col overflow-hidden rounded-[2rem] lg:min-h-0">
              <SessionStrip
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelect={(id) => {
                  setActiveSessionId(id);
                  setMobileTab("chat");
                }}
                onDelete={removeSession}
                onNewSession={createSession}
              />

              <div className="px-3 pb-3 pt-4 sm:px-5 lg:hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--wm-border)] pb-3">
                  <div>
                    <p className="truncate text-sm font-semibold text-[var(--wm-text)]">
                      {project.title}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--wm-muted)]">
                      {Object.keys(project.files).length} files
                    </p>
                  </div>
                  <div className="inline-flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMobileTab("chat")}
                      className={mobileTab === "chat" ? "text-[var(--wm-text)]" : "text-[var(--wm-muted)]"}
                    >
                      Chat
                    </button>
                    <span className="text-[var(--wm-border-strong)]">/</span>
                    <button
                      type="button"
                      onClick={() => setMobileTab("workspace")}
                      className={mobileTab === "workspace" ? "text-[var(--wm-text)]" : "text-[var(--wm-muted)]"}
                    >
                      Workspace
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[70dvh] flex-1 flex-col lg:hidden">
                <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 sm:px-5">
                  {mobileTab === "chat" ? chatPanel : previewPanel}
                </div>
              </div>

              <div className="hidden min-h-0 flex-1 lg:block">
                <ResizablePanel
                  left={chatPanel}
                  right={previewPanel}
                  initialWidth={430}
                  maxWidth={720}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <span suppressHydrationWarning className="sr-only">
        Session: {activeSession.id}
      </span>
    </main>
  );
}
