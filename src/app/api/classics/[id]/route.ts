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

  // Fetched separately and tolerantly — favorited_by may not exist yet if the
  // favorites migration (supabase/favorites-migration.sql) hasn't been run.
  // A missing column here must never 404 the classic itself.
  let favoritedBy: string[] | undefined;
  const { data: favRow, error: favErr } = await supabase
    .from("stories")
    .select("favorited_by")
    .eq("id", id)
    .maybeSingle();
  if (!favErr && Array.isArray(favRow?.favorited_by)) favoritedBy = favRow.favorited_by;

  return NextResponse.json({ blocks: row.blocks ?? [], durationSeconds: row.duration_seconds ?? 0, audioUrl: row.audio_url ?? null, favoritedBy });
}
