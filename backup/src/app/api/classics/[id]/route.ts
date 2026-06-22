import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CLASSIC_STORIES } from "@/lib/classicStories";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

const BUCKET = "classics";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const def = CLASSIC_STORIES.find((s) => s.id === id);
  if (!def) return NextResponse.json({ error: "Unknown classic id" }, { status: 404 });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${id}/script.json`);

  if (error || !data) {
    return NextResponse.json({ error: "Not yet generated" }, { status: 404 });
  }

  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as { blocks: ScriptBlock[]; durationSeconds: number };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Corrupt script data" }, { status: 500 });
  }
}
