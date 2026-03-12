"use client";

import { useCallback } from "react";
import { extractProjectFromResponse, serializeProjectForModel } from "@/lib/project";
import { createId, estimateTokenCount } from "@/lib/utils";
import {
  getActiveSession,
  getActiveSessionMessages,
  useAppStore,
} from "@/lib/store";
import type { Message } from "@/lib/types";

interface GenerateOptions {
  prompt: string;
  includeCurrentProject?: boolean;
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

const toApiMessages = (messages: Message[]): ApiMessage[] => {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
};

export const useGeneration = () => {
  const isGenerating = useAppStore((state) => state.isGenerating);

  const generate = useCallback(
    async ({ prompt, includeCurrentProject = true }: GenerateOptions) => {
      if (!prompt.trim() || isGenerating) {
        return;
      }

      const state = useAppStore.getState();
      const activeSession = getActiveSession(state);

      if (!activeSession) {
        return;
      }

      const userMessageId = createId();
      const assistantMessageId = createId();
      const now = new Date().toISOString();

      state.setLastPrompt(prompt);
      state.setRuntimeError(null);
      state.setGenerating(true);
      state.setStreamingText("");

      state.addMessage(
        {
          id: userMessageId,
          role: "user",
          content: prompt,
          status: "done",
          createdAt: now,
        },
        activeSession.id
      );

      state.addMessage(
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          status: "thinking",
          createdAt: now,
          codeSnapshot: "",
        },
        activeSession.id
      );

      const startedAt = performance.now();
      let firstTokenAt: number | null = null;
      let rawOutput = "";

      try {
        const latestMessages = getActiveSessionMessages(useAppStore.getState());
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: toApiMessages(latestMessages),
            currentProject: includeCurrentProject
              ? serializeProjectForModel(getActiveSession(useAppStore.getState()).currentProject)
              : null,
            modelId: useAppStore.getState().selectedModelId,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Generation failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            continue;
          }

          if (firstTokenAt === null) {
            firstTokenAt = performance.now();
          }

          rawOutput += chunk;
          useAppStore.getState().setStreamingText(rawOutput.slice(-240));

          useAppStore.getState().updateMessage(
            assistantMessageId,
            (message) => ({
              ...message,
              status: "writing",
              codeSnapshot: rawOutput,
              tokenCount: estimateTokenCount(rawOutput),
            }),
            activeSession.id
          );
        }

        const ttfb = firstTokenAt ? Math.round(firstTokenAt - startedAt) : 0;
        const project = extractProjectFromResponse(rawOutput);

        useAppStore.getState().setCurrentProject(project, activeSession.id);
        useAppStore.getState().updateMessage(
          assistantMessageId,
          (message) => ({
            ...message,
            status: "done",
            content: `Created ${Object.keys(project.files).length} files for ${project.title}.`,
            codeSnapshot: rawOutput,
            tokenCount: estimateTokenCount(rawOutput),
            latencyMs: ttfb,
          }),
          activeSession.id
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown generation error";

        useAppStore.getState().updateMessage(
          assistantMessageId,
          (message) => ({
            ...message,
            status: "error",
            content: errorMessage,
          }),
          activeSession.id
        );
      } finally {
        useAppStore.getState().setGenerating(false);
        useAppStore.getState().setStreamingText("");
      }
    },
    [isGenerating]
  );

  return { generate, isGenerating };
};
