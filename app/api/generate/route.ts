import { NextRequest } from "next/server";
import {
  extractAgentActivities,
  type GenerationStreamEvent,
} from "@/lib/agent";
import { buildSystemPrompt, getGeminiClient } from "@/lib/gemini";
import { DEFAULT_LUMINO_MODEL, isLuminoModel } from "@/lib/models";
import { estimateTokenCount } from "@/lib/utils";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface GenerateBody {
  messages: IncomingMessage[];
  currentProject: string | null;
  modelId?: string;
}

export const runtime = "nodejs";

const encodeEvent = (event: GenerationStreamEvent, encoder: TextEncoder) =>
  encoder.encode(`${JSON.stringify(event)}\n`);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;

    if (!Array.isArray(body.messages)) {
      return new Response("Invalid request payload", { status: 400 });
    }

    const client = getGeminiClient();
    const systemPrompt = await buildSystemPrompt();

    const messages = body.messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    if (body.currentProject) {
      messages.push({
        role: "user",
        content:
          `Current project:\n${body.currentProject}\n\n` +
          "Apply the latest request as an edit. Preserve working files unless a redesign requires changing them. Return the full updated project JSON.",
      });
    }

    const requestedModel = body.modelId;
    const modelId =
      requestedModel && isLuminoModel(requestedModel)
        ? requestedModel
        : DEFAULT_LUMINO_MODEL;

    const stream = await client.chat.completions.create({
      model: modelId,
      stream: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let rawOutput = "";
          let emittedActivities = 0;

          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;

            if (!delta) {
              continue;
            }

            rawOutput += delta;
            controller.enqueue(
              encodeEvent(
                {
                  type: "delta",
                  tail: rawOutput.slice(-240),
                  tokenCount: estimateTokenCount(rawOutput),
                },
                encoder
              )
            );

            const activities = extractAgentActivities(rawOutput);
            const newActivities = activities.slice(emittedActivities);

            for (const activity of newActivities) {
              controller.enqueue(
                encodeEvent(
                  {
                    type: "activity",
                    activity,
                  },
                  encoder
                )
              );
            }

            emittedActivities = activities.length;
          }

          controller.enqueue(
            encodeEvent(
              {
                type: "complete",
                rawOutput,
                tokenCount: estimateTokenCount(rawOutput),
              },
              encoder
            )
          );

          controller.close();
        } catch (error) {
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
