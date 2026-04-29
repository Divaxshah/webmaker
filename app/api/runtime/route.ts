import { NextRequest, NextResponse } from "next/server";
import {
  executeRuntimeAction,
  type RuntimeAction,
} from "@/lib/runtime-service";
import type { WorkspaceSnapshot } from "@/lib/types";

interface RuntimeBody {
  action?: RuntimeAction;
  workspace?: WorkspaceSnapshot;
  command?: string;
  processId?: string;
}

export const runtime = "nodejs";

const isWorkspaceSnapshot = (value: unknown): value is WorkspaceSnapshot => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.updatedAt === "string" &&
    typeof record.project === "object" &&
    typeof record.runtime === "object"
  );
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RuntimeBody;

    if (!body.action) {
      return NextResponse.json({ error: "Missing runtime action" }, { status: 400 });
    }

    if (!isWorkspaceSnapshot(body.workspace)) {
      return NextResponse.json({ error: "Invalid workspace payload" }, { status: 400 });
    }

    const result = await executeRuntimeAction(body.workspace, body.action, {
      command: body.command,
      processId: body.processId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected runtime error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
