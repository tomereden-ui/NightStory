import { createHash } from "crypto";
import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryElement {
  id: string;
  storyId: string;
  elementType: "dialogue" | "sfx";
  contentHash: string;
  audioUrl: string;
  durationMs: number;
  characterName?: string;
  textPayload: string;
  createdAt: number;
}

// ─── Hash helpers ─────────────────────────────────────────────────────────────

/** Stable key for a dialogue line: character + exact text + resolved voice ID. */
export function hashDialogue(character: string, line: string, voiceKey: string): string {
  return createHash("sha256")
    .update(`d|${character}|${line}|${voiceKey}`)
    .digest("hex")
    .slice(0, 24);
}

/** Stable key for an SFX clip: just the description (looping is handled at mix time). */
export function hashSfx(description: string): string {
  return createHash("sha256")
    .update(`s|${description}`)
    .digest("hex")
    .slice(0, 24);
}

// ─── Supabase bucket ──────────────────────────────────────────────────────────

const BUCKET = "element-audio";

export async function ensureElementsBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[ElementStore] bucket create:", error.message);
  }
}

// ─── Cache lookup ─────────────────────────────────────────────────────────────

/**
 * Load all cached elements for a story into a hash → element map.
 * Returns an empty map if the table doesn't exist yet (graceful degradation).
 */
export async function getElementsForStory(
  storyId: string,
): Promise<Map<string, StoryElement>> {
  const map = new Map<string, StoryElement>();
  try {
    const { data, error } = await supabase
      .from("story_elements")
      .select("*")
      .eq("story_id", storyId);
    if (error) {
      console.warn("[ElementStore] getElementsForStory:", error.message);
      return map;
    }
    for (const row of data ?? []) {
      map.set(row.content_hash, {
        id: row.id,
        storyId: row.story_id,
        elementType: row.element_type,
        contentHash: row.content_hash,
        audioUrl: row.audio_url,
        durationMs: row.duration_ms,
        characterName: row.character_name ?? undefined,
        textPayload: row.text_payload,
        createdAt: row.created_at,
      });
    }
  } catch (err) {
    console.warn("[ElementStore] getElementsForStory exception:", err);
  }
  return map;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a local audio file to the element-audio bucket.
 * Returns the public URL.
 */
export async function uploadElementAudio(
  storyId: string,
  contentHash: string,
  localPath: string,
): Promise<string> {
  // Dynamic require to match the produce-drama pattern (avoids ES module hoisting issues)
  const fs = require("fs") as typeof import("fs"); // eslint-disable-line
  const path = require("path") as typeof import("path"); // eslint-disable-line

  await ensureElementsBucket();
  const ext = path.extname(localPath).slice(1) || "mp3";
  const storageKey = `${storyId}/${contentHash}.${ext}`;
  const buf = fs.readFileSync(localPath);
  const contentType = ext === "wav" ? "audio/wav" : "audio/mpeg";
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, buf, { contentType, upsert: true });
  if (error) throw new Error(`uploadElementAudio: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storageKey).data.publicUrl;
}

// ─── Persist ──────────────────────────────────────────────────────────────────

/** Upsert a batch of newly generated elements into the DB. */
export async function saveStoryElements(elements: StoryElement[]): Promise<void> {
  if (elements.length === 0) return;
  const rows = elements.map((e) => ({
    id: e.id,
    story_id: e.storyId,
    element_type: e.elementType,
    content_hash: e.contentHash,
    audio_url: e.audioUrl,
    duration_ms: e.durationMs,
    character_name: e.characterName ?? null,
    text_payload: e.textPayload,
    created_at: e.createdAt,
  }));
  const { error } = await supabase
    .from("story_elements")
    .upsert(rows, { onConflict: "id" });
  if (error) console.warn("[ElementStore] saveStoryElements:", error.message);
}

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * Download a URL to a local file path.
 * Returns true on success. Uses global fetch (Node 18+ / Next.js).
 */
export async function downloadToFile(
  url: string,
  destPath: string,
): Promise<boolean> {
  const fs = require("fs") as typeof import("fs"); // eslint-disable-line
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buf));
    return true;
  } catch {
    try { fs.unlinkSync(destPath); } catch { /* ignore */ }
    return false;
  }
}
