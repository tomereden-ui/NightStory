import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getEntry } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

// Admin tool: drop just the audio file from a story (any owner — same
// no-familyId pattern as refresh-story/migrate-classics-to-db) so it can be
// re-produced without touching the script, cover, scenes, or anything else.
export async function POST(req: NextRequest) {
  let body: { storyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const storyId = body.storyId?.trim();
  if (!storyId) return NextResponse.json({ error: "storyId required." }, { status: 400 });

  const entry = await getEntry(storyId);
  if (!entry) return NextResponse.json({ error: "Story not found." }, { status: 404 });
  if (!entry.audioUrl) {
    return NextResponse.json({ ok: true, title: entry.title, removedFile: false, note: "Story already had no audio_url — nothing to remove." });
  }

  // Storage key is whatever comes after ".../object/public/audio/" in the
  // stored URL, rather than assuming an extension — produce-drama writes
  // either .mp3 or .wav depending on which mixing path succeeded.
  const marker = "/object/public/audio/";
  const idx = entry.audioUrl.indexOf(marker);
  let removedFile = false;
  if (idx !== -1) {
    const storageKey = decodeURIComponent(entry.audioUrl.slice(idx + marker.length).split("?")[0]);
    const { error: removeErr } = await supabase.storage.from("audio").remove([storageKey]);
    if (removeErr) {
      console.warn(`[admin/delete-audio] Storage remove failed for ${storyId} (${storageKey}):`, removeErr.message);
    } else {
      removedFile = true;
    }
  } else {
    console.warn(`[admin/delete-audio] audio_url for ${storyId} doesn't match the expected audio bucket pattern, skipping storage removal:`, entry.audioUrl);
  }

  // .update() returns {error: null} even on a zero-row match — verify the
  // row actually exists and was touched instead of trusting a silent no-op.
  const { data, error } = await supabase
    .from("stories")
    .update({ audio_url: null })
    .eq("id", storyId)
    .select("id");
  if (error) {
    console.error(`[admin/delete-audio] DB update failed for ${storyId}:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Story vanished between lookup and update — try again." }, { status: 404 });
  }

  console.log(`[admin/delete-audio] Cleared audio for "${entry.title}" (${storyId}) — file removed: ${removedFile}`);
  return NextResponse.json({ ok: true, title: entry.title, removedFile });
}
