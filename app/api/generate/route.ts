import { NextRequest } from "next/server";
import type { GenerationStreamEvent } from "@/lib/agent";
import { runAgentLoop } from "@/lib/agent-runtime";
import { DEFAULT_LUMINO_MODEL, isLuminoModel } from "@/lib/models";
import { normalizeProject } from "@/lib/project";
import type { GeneratedProject, WorkspaceSnapshot } from "@/lib/types";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

interface GenerateBody {
  messages: IncomingMessage[];
  currentProject: GeneratedProject | null;
  sessionWorkspace?: WorkspaceSnapshot | null;
  modelId?: string;
  activeSkillIds?: string[];
}

export const runtime = "nodejs";

const encodeEvent = (event: GenerationStreamEvent, encoder: TextEncoder) =>
  encoder.encode(`${JSON.stringify(event)}\n`);

const isWorkspaceSnapshot = (value: unknown): value is WorkspaceSnapshot => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.updatedAt === "string" &&
    typeof record.project === "object" &&
    record.project !== null &&
    typeof record.runtime === "object" &&
    record.runtime !== null
  );
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;

    if (!Array.isArray(body.messages)) {
      return new Response("Invalid request payload", { status: 400 });
    }

    const messages = body.messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .map((message) => {
        const base = {
          role: message.role,
          content: message.content,
        };
        if (
          message.role === "assistant" &&
          message.reasoning_details !== undefined
        ) {
          return { ...base, reasoning_details: message.reasoning_details };
        }
        return base;
      });

    const requestedModel = body.modelId;
    const modelId =
      requestedModel && isLuminoModel(requestedModel)
        ? requestedModel
        : DEFAULT_LUMINO_MODEL;

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await runAgentLoop({
            messages,
            currentProject: body.currentProject
              ? normalizeProject(body.currentProject)
              : null,
            sessionWorkspace:
              body.sessionWorkspace != null &&
              isWorkspaceSnapshot(body.sessionWorkspace)
                ? body.sessionWorkspace
                : null,
            modelId,
            activeSkillIds: Array.isArray(body.activeSkillIds)
              ? body.activeSkillIds.filter(
                  (skillId): skillId is string => typeof skillId === "string"
                )
              : [],
            signal: request.signal,
            onEvent: (event) => {
              controller.enqueue(encodeEvent(event, encoder));
            },
          });
          controller.close();
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            controller.close();
            return;
          }

          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected generation error";
    return new Response(message, { status: 500 });
  }
}
