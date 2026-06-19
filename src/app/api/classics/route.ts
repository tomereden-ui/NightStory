import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CLASSIC_STORIES, type ClassicMeta } from "@/lib/classicStories";
import type { ScriptBlock } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import { fetchPollinationsImage } from "@/lib/services/pollinationsClient";

export const dynamic = "force-dynamic";

const BUCKET = "classics";

async function ensureClassicsBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[Classics] bucket error:", error.message);
  }
}

function coverPath(id: string) { return `${id}/cover.jpg`; }
function scriptPath(id: string) { return `${id}/script.json`; }

function publicUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

// GET — list all classics with status + cached metadata
export async function GET() {
  await ensureClassicsBucket();

  const metas: ClassicMeta[] = await Promise.all(
    CLASSIC_STORIES.map(async (def) => {
      // Check if script exists in storage
      const { data: scriptData } = await supabase.storage
        .from(BUCKET)
        .download(scriptPath(def.id));

      const hasScript = Boolean(scriptData);
      const hasCover = hasScript; // cover is generated together with script

      let durationSeconds: number | undefined;
      if (hasScript && scriptData) {
        try {
          const text = await scriptData.text();
          const parsed = JSON.parse(text) as { blocks?: ScriptBlock[]; durationSeconds?: number };
          durationSeconds = parsed.durationSeconds;
        } catch {}
      }

      return {
        id: def.id,
        title: def.title,
        emoji: def.emoji,
        tagline: def.tagline,
        coverUrl: hasCover ? publicUrl(coverPath(def.id)) : undefined,
        durationSeconds,
        status: hasScript ? "ready" : "pending",
      } satisfies ClassicMeta;
    })
  );

  return NextResponse.json(metas);
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
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
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

  const meta: ClassicMeta = {
    id: def.id,
    title: def.title,
    emoji: def.emoji,
    tagline: def.tagline,
    coverUrl: coverUploaded ? publicUrl(coverPath(def.id)) : undefined,
    durationSeconds,
    status: "ready",
  };

  return NextResponse.json({ ok: true, meta, blockCount: blocks.length });
}
