import { NextResponse } from "next/server";
import { listAvailableSkills } from "@/lib/skills";

export const runtime = "nodejs";

export async function GET() {
  try {
    const skills = await listAvailableSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected skills error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
