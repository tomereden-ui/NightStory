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

  // A classic (hardcoded or admin-added) "graduates" to a real stories row the
  // moment its script is generated, and stays keyed to the same id once audio
  // is produced (produce-drama's editingStoryId). Prefer that row whenever it
  // exists so a hardcoded classic behaves identically to an admin-added one —
  // same favorites, same share support.
  const { data: row, error: dbErr } = await supabase
    .from("stories")
    .select("blocks, duration_seconds, audio_url, favorited_by, scenes")
    .eq("id", id)
    .maybeSingle();

  if (row && !dbErr) {
    return NextResponse.json({
      blocks: row.blocks ?? [],
      durationSeconds: row.duration_seconds ?? 0,
      audioUrl: row.audio_url ?? null,
      favoritedBy: Array.isArray(row.favorited_by) ? row.favorited_by : undefined,
      scenes: Array.isArray(row.scenes) ? row.scenes : undefined,
    });
  }

  const isHardcoded = CLASSIC_STORIES.some((s) => s.id === id);
  if (!isHardcoded) {
    return NextResponse.json({ error: "Classic not found" }, { status: 404 });
  }

  // Not yet generated as a row (legacy fallback) — serve straight from Storage.
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
