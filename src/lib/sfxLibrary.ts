import { supabase } from "./supabase";
import { spawn } from "child_process";
import fs from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SfxLibraryEntry {
  id: string;
  description: string;
  durationMs: number;
  audioUrl: string;
  createdAt: number;
}

export interface SfxLibraryRow extends SfxLibraryEntry {
  hitCount: number;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json() as { embedding?: { values?: number[] } };
    return json.embedding?.values ?? null;
  } catch {
    return null;
  }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Fallback when embedding is unavailable: token-overlap (Jaccard on word bags)
function wordOverlapSim(a: string, b: string): number {
  const tokens = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  const intersection = ta.filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tokens(b)]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.90;

// ─── Duration fitting ─────────────────────────────────────────────────────────

function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = require("ffmpeg-static") as string | null; // eslint-disable-line
    if (p && fs.existsSync(p)) return p;
  } catch { /* not installed */ }
  for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("ffmpeg not found");
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    const err: string[] = [];
    proc.stderr?.on("data", (d: Buffer) => err.push(d.toString()));
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg ${code}: ${err.slice(-2).join("")}`)));
    proc.on("error", reject);
  });
}

/**
 * Fit a cached audio file to the required duration in-place:
 * - If the file is longer → trim with a short fade-out so it doesn't cut abruptly
 * - If the file is shorter → loop it seamlessly to fill the target length
 *
 * Writes the result to `outputPath` (may differ from `inputPath`).
 * For looping ambient tracks no fitting is needed — the mixer handles looping.
 */
export async function fitAudioDuration(
  inputPath: string,
  outputPath: string,
  targetMs: number,
): Promise<void> {
  const targetSec = targetMs / 1000;
  const fadeSec   = Math.min(0.4, targetSec * 0.1); // short fade-out, max 0.4s

  // Trim + fade-out
  await runFfmpeg([
    "-y",
    "-stream_loop", "-1",        // loop input indefinitely so short clips fill the gap
    "-i", inputPath,
    "-t", targetSec.toFixed(3),
    "-af", `afade=t=out:st=${(targetSec - fadeSec).toFixed(3)}:d=${fadeSec.toFixed(3)}`,
    "-c:a", "libmp3lame", "-q:a", "4",
    outputPath,
  ]);
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Search the global SFX library for a semantically similar clip.
 * Duration is no longer a rejection criterion — callers use fitAudioDuration
 * to adapt any hit to the required length.
 * Returns null only when no entry scores ≥ threshold.
 */
export async function findSimilarSfx(
  description: string,
  opts: { threshold?: number } = {},
): Promise<SfxLibraryEntry | null> {
  const { threshold = SIMILARITY_THRESHOLD } = opts;

  try {
    const { data, error } = await supabase
      .from("sfx_library")
      .select("id, description, duration_ms, audio_url, embedding, created_at");

    if (error || !data?.length) return null;

    const queryEmbedding = await embedText(description);

    let best: SfxLibraryEntry | null = null;
    let bestScore = -1;

    for (const row of data) {
      let score: number;
      if (queryEmbedding && row.embedding) {
        const storedEmb = (Array.isArray(row.embedding)
          ? row.embedding
          : Object.values(row.embedding)) as number[];
        score = cosineSim(queryEmbedding, storedEmb);
      } else {
        score = wordOverlapSim(description, row.description as string);
      }

      if (score > bestScore) {
        bestScore = score;
        best = {
          id: row.id as string,
          description: row.description as string,
          durationMs: row.duration_ms as number,
          audioUrl: row.audio_url as string,
          createdAt: row.created_at as number,
        };
      }
    }

    if (bestScore >= threshold && best) {
      console.log(`[SfxLibrary] Hit — score ${bestScore.toFixed(3)} for "${description.slice(0, 50)}"`);
      return best;
    }
    return null;
  } catch (err) {
    console.warn("[SfxLibrary] findSimilarSfx error:", err);
    return null;
  }
}

/**
 * Best-effort, fire-and-forget: record that a global library clip (found via
 * findSimilarSfx, not a fresh generation) was reused for another story. Not
 * atomic — a read-then-write, same tradeoff as elementStore's
 * bumpElementHitCount — fine for approximate stats, not a precise ledger.
 */
export async function bumpSfxHitCount(id: string): Promise<void> {
  try {
    const { data } = await supabase.from("sfx_library").select("hit_count").eq("id", id).maybeSingle();
    const current = typeof data?.hit_count === "number" ? data.hit_count : 0;
    await supabase.from("sfx_library").update({ hit_count: current + 1 }).eq("id", id);
  } catch (err) {
    console.warn("[SfxLibrary] bumpSfxHitCount:", err);
  }
}

/** List every cached SFX entry, most-reused first, for the admin SFX panel. */
export async function listSfxLibrary(): Promise<SfxLibraryRow[]> {
  const { data, error } = await supabase
    .from("sfx_library")
    .select("id, description, duration_ms, audio_url, created_at, hit_count")
    .order("hit_count", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    description: row.description as string,
    durationMs: row.duration_ms as number,
    audioUrl: row.audio_url as string,
    createdAt: row.created_at as number,
    hitCount: typeof row.hit_count === "number" ? row.hit_count : 0,
  }));
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Persist a newly generated SFX clip to the global library.
 * Embeds the description for future similarity lookups.
 */
export async function saveSfxLibraryEntry(
  description: string,
  durationMs: number,
  audioUrl: string,
): Promise<void> {
  try {
    const embedding = await embedText(description);
    const id = `sfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from("sfx_library").insert({
      id,
      description,
      duration_ms: Math.round(durationMs),
      audio_url: audioUrl,
      embedding: embedding ?? null,
      created_at: Date.now(),
    });
    if (error) console.warn("[SfxLibrary] insert error:", error.message);
  } catch (err) {
    console.warn("[SfxLibrary] saveSfxLibraryEntry error:", err);
  }
}
