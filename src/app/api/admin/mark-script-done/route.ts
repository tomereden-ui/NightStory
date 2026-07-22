import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { markScriptDone } from "@/lib/perfMetrics";

export const dynamic = "force-dynamic";

// Admin's Add Story flow doesn't create a real `stories` draft row up front
// the way Studio's flow does (POST /api/library, which calls markScriptDone
// as a side effect) — admin stages everything in an in-memory job until the
// admin explicitly clicks Save. Without a 'script_done' row to find,
// ProductionTimer.flush (perfMetrics.ts) never has anything to update in
// place, so every Produce click — including a re-produce after a director's-
// note revision, or a preview the admin never actually saves — inserted a
// brand-new production_metrics row instead of updating one, leaving orphaned
// rows with no coherent per-story history. Call this once, right after
// Process Script, with the same id later passed to /api/produce-drama as
// editingStoryId — mirrors /api/library's own call exactly, just without
// creating a `stories` row admin doesn't want yet.
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    storyId?: string;
    title?: string;
    language?: string;
    dialogueCount?: number;
    sfxCount?: number;
  };
  if (!body.storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  await markScriptDone(supabase, {
    storyId: body.storyId,
    storyTitle: body.title,
    language: body.language,
    dialogueCount: body.dialogueCount,
    sfxCount: body.sfxCount,
  });

  return NextResponse.json({ ok: true });
}
