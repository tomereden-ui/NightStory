import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { saveSfxLibraryEntry } from "@/lib/sfxLibrary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  // 1. Fetch all SFX elements across all stories
  const { data: sfxRows, error } = await supabase
    .from("story_elements")
    .select("text_payload, duration_ms, audio_url")
    .eq("element_type", "sfx");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sfxRows?.length) return NextResponse.json({ seeded: 0, skipped: 0, total: 0 });

  // 2. Deduplicate by exact description — keep the longest clip for each description
  const byDesc = new Map<string, { durationMs: number; audioUrl: string }>();
  for (const row of sfxRows) {
    const desc = (row.text_payload as string)?.trim();
    if (!desc || !row.audio_url) continue;
    const existing = byDesc.get(desc);
    if (!existing || (row.duration_ms as number) > existing.durationMs) {
      byDesc.set(desc, { durationMs: row.duration_ms as number, audioUrl: row.audio_url as string });
    }
  }

  // 3. Check which descriptions are already in sfx_library
  const { data: existing } = await supabase
    .from("sfx_library")
    .select("description");
  const alreadyStored = new Set((existing ?? []).map((r) => (r.description as string).trim()));

  // 4. Insert missing ones — sequential to avoid Gemini embedding rate limits
  let seeded = 0;
  let skipped = 0;
  const toSeed = Array.from(byDesc.entries()).filter(([desc]) => !alreadyStored.has(desc));

  for (const [desc, { durationMs, audioUrl }] of toSeed) {
    try {
      await saveSfxLibraryEntry(desc, durationMs, audioUrl);
      seeded++;
    } catch {
      skipped++;
    }
    // Small pause to avoid hitting Gemini embedding rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    total: byDesc.size,
    seeded,
    skipped,
    alreadyInLibrary: alreadyStored.size,
  });
}
