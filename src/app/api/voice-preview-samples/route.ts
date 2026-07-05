import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — returns every generated sample as { [voiceId]: { en, he, fr, es } }.
// Tolerant: if the migration hasn't been run yet, returns an empty map
// instead of erroring so the picker just falls back to its old behavior.
export async function GET() {
  const { data, error } = await supabase
    .from("voice_preview_samples")
    .select("voice_id, language, audio_url");

  if (error || !data) return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });

  const map: Record<string, Record<string, string>> = {};
  for (const row of data) {
    (map[row.voice_id] ??= {})[row.language] = row.audio_url;
  }
  // Explicit no-store — this list grows every time the admin regenerates
  // samples, and without this header a browser can silently keep serving an
  // old cached response (e.g. the very first 9-voice batch) indefinitely.
  return NextResponse.json(map, { headers: { "Cache-Control": "no-store" } });
}
