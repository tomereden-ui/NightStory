import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CLASSIC_STORIES, type ClassicMeta } from "@/lib/classicStories";
import type { ScriptBlock } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import { fetchPollinationsImage } from "@/lib/services/pollinationsClient";
import { addEntry } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

const BUCKET = "classics";

let classicsBucketReady = false;
async function ensureClassicsBucket() {
  if (classicsBucketReady) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[Classics] bucket error:", error.message);
  }
  classicsBucketReady = true;
}

function coverPath(id: string) { return `${id}/cover.jpg`; }
function scriptPath(id: string) { return `${id}/script.json`; }

function publicUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

// GET — list all classics: DB rows take priority, Storage used for pending fallback
export async function GET() {
  await ensureClassicsBucket();

  // Load DB rows for classics that have been generated (is_classic=true)
  const { data: dbRows } = await supabase
    .from("stories")
    .select("id, title, emoji, summary, cover_url, duration_seconds, favorited_by")
    .eq("is_public", true)
    .eq("is_classic", true);

  const dbById = new Map((dbRows ?? []).map((r) => [r.id, r]));

  // A trashed classic has no DB row and (once moveToTrash's cleanup runs) no
  // Storage cache either — indistinguishable from "never generated yet"
  // without this check. Without it, the client's background auto-generate
  // effect (library/page.tsx) treats a deliberate delete as "pending" and
  // silently regenerates the exact story that was just removed, seconds
  // later, from the same hardcoded id.
  const { data: trashedRows } = await supabase
    .from("trash")
    .select("id")
    .eq("is_classic", true)
    .in("id", CLASSIC_STORIES.map((d) => d.id));
  const trashedIds = new Set((trashedRows ?? []).map((r) => r.id as string));

  const metas: ClassicMeta[] = await Promise.all(
    CLASSIC_STORIES.filter((def) => !trashedIds.has(def.id)).map(async (def) => {
      const row = dbById.get(def.id);
      if (row) {
        return {
          id: def.id,
          title: def.title,
          emoji: def.emoji,
          tagline: row.summary ?? def.tagline,
          coverUrl: row.cover_url ?? undefined,
          durationSeconds: row.duration_seconds ?? undefined,
          status: "ready",
          favoritedBy: Array.isArray(row.favorited_by) ? row.favorited_by : undefined,
        } satisfies ClassicMeta;
      }

      // Not in DB yet — check Storage (legacy / pending)
      const { data: files } = await supabase.storage.from(BUCKET).list(def.id);
      const fileNames = new Set((files ?? []).map((f) => f.name));
      const hasScript = fileNames.has("script.json");
      const hasCover = fileNames.has("cover.jpg") || fileNames.has("cover.png");
      const coverExt = fileNames.has("cover.png") ? "png" : "jpg";

      let durationSeconds: number | undefined;
      if (hasScript) {
        try {
          const { data: scriptData } = await supabase.storage.from(BUCKET).download(scriptPath(def.id));
          if (scriptData) {
            const text = await scriptData.text();
            const parsed = JSON.parse(text) as { blocks?: ScriptBlock[]; durationSeconds?: number };
            durationSeconds = parsed.durationSeconds;
          }
        } catch {}
      }

      return {
        id: def.id,
        title: def.title,
        emoji: def.emoji,
        tagline: def.tagline,
        coverUrl: hasCover ? publicUrl(`${def.id}/cover.${coverExt}`) : undefined,
        durationSeconds,
        status: hasScript ? "ready" : "pending",
      } satisfies ClassicMeta;
    })
  );

  // Also include admin-added stories (is_classic=true) whose IDs aren't in CLASSIC_STORIES
  const hardcodedIds = new Set(CLASSIC_STORIES.map((s) => s.id));
  const adminClassics: ClassicMeta[] = (dbRows ?? [])
    .filter((r) => !hardcodedIds.has(r.id))
    .map((r) => ({
      id: r.id,
      title: r.title,
      emoji: r.emoji ?? "✨",
      tagline: r.summary ?? "",
      coverUrl: r.cover_url ?? undefined,
      durationSeconds: r.duration_seconds ?? undefined,
      status: "ready" as const,
      favoritedBy: Array.isArray(r.favorited_by) ? r.favorited_by : undefined,
    }));

  return NextResponse.json([...metas, ...adminClassics]);
}

// POST { id } — generate (or regenerate) a single classic story
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let id: string;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const def = CLASSIC_STORIES.find((s) => s.id === id);
  if (!def) return NextResponse.json({ error: "Unknown classic id" }, { status: 404 });

  await ensureClassicsBucket();

  // ── 1. Generate script via Gemini ──────────────────────────────────────────
  const systemInstruction = `You are a professional children's audio drama writer. You will receive a story brief and must return a JSON array of script blocks.

RULES:
- Return ONLY a raw JSON array, no markdown fences, no explanation.
- Each block: { "characterName": string, "textPayload": string }
- Use "Narrator" for narration, character names for dialogue.
- Use "SFX" for sound effects (textPayload = brief sound description, e.g. "soft wind chimes fade")
- Keep language warm, gentle, age-appropriate for children 4–8.
- Aim for 25–40 blocks total for a ~3 minute story.
- Every character name must be consistent throughout (same capitalization).`;

  let blocks: ScriptBlock[] = [];

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: def.scriptPrompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 0 } },
    });

    const raw = geminiText(data);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{ characterName: string; textPayload: string }>;

    blocks = parsed
      .filter((b) => b.characterName && b.textPayload)
      .map((b, i) => ({
        id: `blk-${def.id}-${i}`,
        blockOrder: i,
        characterName: b.characterName,
        assignedVoiceId: "",
        textPayload: b.textPayload,
      }));
  } catch (err) {
    console.error("[Classics] Script generation failed:", err);
    return NextResponse.json({ error: "Script generation failed" }, { status: 502 });
  }

  if (blocks.length === 0) {
    return NextResponse.json({ error: "Gemini returned empty script" }, { status: 502 });
  }

  // ── 2. Generate cover via Pollinations ─────────────────────────────────────
  let coverUploaded = false;
  try {
    const result = await fetchPollinationsImage(def.coverPrompt, `Classic-${def.id}`, { width: 768, height: 768 });
    if (result) {
      const blob = new Blob([result.buf.buffer as ArrayBuffer], { type: result.mimeType });
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(coverPath(def.id), blob, { upsert: true, contentType: result.mimeType });
      if (!error) coverUploaded = true;
      else console.warn("[Classics] Cover upload error:", error.message);
    }
  } catch (err) {
    console.warn("[Classics] Cover generation failed:", err);
  }

  // Estimate duration: ~145 wpm for children's narration
  const wordCount = blocks
    .filter((b) => b.characterName !== "SFX")
    .reduce((sum, b) => sum + b.textPayload.split(/\s+/).length, 0);
  const durationSeconds = Math.round((wordCount / 145) * 60);

  // ── 3. Store script to Supabase Storage ────────────────────────────────────
  const payload = JSON.stringify({ blocks, durationSeconds });
  const scriptBlob = new Blob([payload], { type: "application/json" });
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(scriptPath(def.id), scriptBlob, { upsert: true, contentType: "application/json" });

  if (uploadError) {
    console.error("[Classics] Script upload failed:", uploadError.message);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  const coverUrl = coverUploaded ? publicUrl(coverPath(def.id)) : undefined;

  const meta: ClassicMeta = {
    id: def.id,
    title: def.title,
    emoji: def.emoji,
    tagline: def.tagline,
    coverUrl,
    durationSeconds,
    status: "ready",
  };

  // Persist to stories table as a public (is_public) entry
  await addEntry({
    id: def.id,
    title: def.title,
    summary: def.tagline,
    coverUrl,
    durationSeconds,
    createdAt: Date.now(),
    blocks,
    emoji: def.emoji,
    isPublic: true,
    isClassic: true,
  });

  return NextResponse.json({ ok: true, meta, blockCount: blocks.length });
}
