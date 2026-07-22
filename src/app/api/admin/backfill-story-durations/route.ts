import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Corrects `stories.duration_seconds` for already-produced stories whose
// stored value was the pre-mix PLANNED target (adjustedTotal in
// produce-drama/route.ts), not the real length of the merged/concatenated
// output file — see that route's `finalDurationMs` fix. That fix only
// applies to stories produced going forward; this backfill re-probes every
// existing story's real audio file so Home's progress bar (which divides by
// duration_seconds) lines up with what the player actually measures
// (audio.duration) and where a saved position resumes to.
//
// Defaults to a dry run — call with ?dryRun=false to actually write.

/** Read actual duration of a WAV buffer from its header. */
function wavDurationMsFromBuffer(buf: Buffer): number {
  try {
    if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return 0;
    const sampleRate = buf.readUInt32LE(24);
    const numChannels = buf.readUInt16LE(22);
    const bitsPerSample = buf.readUInt16LE(34);
    const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
    if (!bytesPerSec) return 0;
    let pos = 12;
    while (pos < buf.length - 8) {
      const id = buf.toString("ascii", pos, pos + 4);
      const size = buf.readUInt32LE(pos + 4);
      if (id === "data") return Math.round((size / bytesPerSec) * 1000);
      pos += 8 + size + (size % 2);
    }
  } catch { /* ignore */ }
  return 0;
}

// Every mp3 this app produces is encoded at a fixed 128kbps (see mixTracks /
// concatenateTracks's "-ab 128k"), so a size-based estimate is accurate, not
// just approximate — matches produce-drama/route.ts's own mp3DurationMs.
function mp3DurationMsFromByteLength(byteLength: number): number {
  return Math.round((byteLength / (128 * 1024 / 8)) * 1000);
}

async function measureRealDurationMs(url: string): Promise<number> {
  if (url.endsWith(".wav")) {
    const res = await fetch(url);
    if (!res.ok) return 0;
    return wavDurationMsFromBuffer(Buffer.from(await res.arrayBuffer()));
  }
  // mp3 (or unrecognized extension — everything else this app produces is
  // mp3) — HEAD-only in the common case, avoiding a full download per story.
  try {
    const headRes = await fetch(url, { method: "HEAD" });
    if (headRes.ok) {
      const len = Number(headRes.headers.get("content-length"));
      if (len > 0) return mp3DurationMsFromByteLength(len);
    }
  } catch { /* fall through to full GET below */ }
  const res = await fetch(url);
  if (!res.ok) return 0;
  return mp3DurationMsFromByteLength((await res.arrayBuffer()).byteLength);
}

interface StoryRow {
  id: string;
  title: string;
  audio_url: string | null;
  duration_seconds: number | null;
}

export async function GET(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dryRun") !== "false";
  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
  const rawThreshold = Number(req.nextUrl.searchParams.get("thresholdSeconds"));
  const thresholdSeconds = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 2;

  let query = supabase
    .from("stories")
    .select("id, title, audio_url, duration_seconds")
    .not("audio_url", "is", null);
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: `Fetch failed: ${error.message}` }, { status: 500 });

  const rows = (data ?? []) as StoryRow[];
  const mismatches: Array<{ id: string; title: string; oldSeconds: number; newSeconds: number; updated: boolean }> = [];
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.audio_url) continue;
    try {
      const ms = await measureRealDurationMs(row.audio_url);
      if (ms <= 0) { errors.push(`${row.id} (${row.title}): could not measure duration`); continue; }
      const newSeconds = Math.round(ms / 1000);
      const oldSeconds = row.duration_seconds ?? 0;
      if (Math.abs(newSeconds - oldSeconds) <= thresholdSeconds) continue;

      let updated = false;
      if (!dryRun) {
        const { error: updErr } = await supabase.from("stories").update({ duration_seconds: newSeconds }).eq("id", row.id);
        if (updErr) { errors.push(`${row.id} (${row.title}): ${updErr.message}`); continue; }
        updated = true;
      }
      mismatches.push({ id: row.id, title: row.title, oldSeconds, newSeconds, updated });
    } catch (err) {
      errors.push(`${row.id} (${row.title}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    dryRun,
    totalScanned: rows.length,
    mismatchesFound: mismatches.length,
    updated: mismatches.filter((m) => m.updated).length,
    mismatches,
    errors: errors.slice(0, 20),
  });
}
