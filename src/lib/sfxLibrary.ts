import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SfxLibraryEntry {
  id: string;
  description: string;
  durationMs: number;
  audioUrl: string;
  createdAt: number;
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
const DURATION_TOLERANCE   = 0.40; // cached duration must be within ±40% of requested

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Search the global SFX library for a semantically similar clip.
 *
 * Returns the best match if its similarity score ≥ threshold AND its duration
 * is within DURATION_TOLERANCE of the requested duration (looping clips skip
 * the duration check since they repeat).
 */
export async function findSimilarSfx(
  description: string,
  durationMs: number,
  opts: { threshold?: number; isLooping?: boolean } = {},
): Promise<SfxLibraryEntry | null> {
  const { threshold = SIMILARITY_THRESHOLD, isLooping = false } = opts;

  try {
    const { data, error } = await supabase
      .from("sfx_library")
      .select("id, description, duration_ms, audio_url, embedding, created_at");

    if (error || !data?.length) return null;

    // Generate query embedding once; fall back to word-overlap per row if it fails
    const queryEmbedding = await embedText(description);

    let best: SfxLibraryEntry | null = null;
    let bestScore = -1;

    for (const row of data) {
      // Duration gate — skip clips that are too short or too long for this slot
      if (!isLooping) {
        const ratio = row.duration_ms / durationMs;
        if (ratio < 1 - DURATION_TOLERANCE || ratio > 1 + DURATION_TOLERANCE) continue;
      }

      // Similarity — prefer embeddings; fall back to word overlap
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
      console.log(
        `[SfxLibrary] Hit — score ${bestScore.toFixed(3)} for "${description.slice(0, 50)}"`,
      );
      return best;
    }
    return null;
  } catch (err) {
    console.warn("[SfxLibrary] findSimilarSfx error:", err);
    return null;
  }
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
