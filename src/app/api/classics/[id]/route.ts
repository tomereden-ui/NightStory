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
  const isHardcoded = CLASSIC_STORIES.some((s) => s.id === id);

  if (isHardcoded) {
    // Serve from Supabase Storage (generated script JSON)
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

  // Admin-added classic: fetch blocks directly from the stories table
  const { data: row, error: dbErr } = await supabase
    .from("stories")
    .select("blocks, duration_seconds, audio_url")
    .eq("id", id)
    .eq("is_classic", true)
    .maybeSingle();

  if (dbErr || !row) {
    return NextResponse.json({ error: "Classic not found" }, { status: 404 });
  }

  return NextResponse.json({ blocks: row.blocks ?? [], durationSeconds: row.duration_seconds ?? 0, audioUrl: row.audio_url ?? null });
}
