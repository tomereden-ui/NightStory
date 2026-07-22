import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { synthesizeLine } from "@/lib/services/ttsService";
import { buildNamePronunciationMap, applyPronunciationOverrides } from "@/lib/services/pronunciationOverride";

export const dynamic = "force-dynamic";

const BUCKET = "audio";
const NARRATOR_VOICE = "Charon";

function storagePath(cacheKey: string) {
  return `summary/${cacheKey}.wav`;
}

function publicUrl(filePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

export async function POST(req: NextRequest) {
  const gemKey = process.env.GEMINI_API_KEY;
  if (!gemKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: { text: string; cacheKey: string; childIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { text, cacheKey, childIds } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });
  if (!cacheKey?.trim()) return NextResponse.json({ error: "cacheKey is required." }, { status: 400 });

  // Real summary text is what's cached/displayed — this substitution only
  // ever touches speakText, the copy handed to TTS (see onboarding's "Does
  // this sound right?" flow for where the override is confirmed/saved).
  const namePronunciationMap = await buildNamePronunciationMap(childIds);
  const speakText = applyPronunciationOverrides(text.trim(), namePronunciationMap);

  await ensureBuckets();

  // Check if already cached in storage
  const filePath = storagePath(cacheKey);
  const { data: existing } = await supabase.storage.from(BUCKET).list("summary", {
    search: `${cacheKey}.wav`,
  });

  if (existing && existing.some((f) => f.name === `${cacheKey}.wav`)) {
    return NextResponse.json({ audioUrl: publicUrl(filePath) });
  }

  // Generate via Gemini TTS
  const tmpPath = path.join(os.tmpdir(), `summary-${cacheKey}.wav`);
  try {
    await synthesizeLine(
      speakText,
      NARRATOR_VOICE,
      gemKey,
      tmpPath,
      undefined,
      false, // useElevenLabs
      undefined,
      undefined,
      "en",
      { maxAttempts: 2, perAttemptTimeoutMs: 25_000 },
    );

    const audioBuffer = fs.readFileSync(tmpPath);
    const blob = new Blob([audioBuffer], { type: "audio/wav" });

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, blob, { upsert: true, contentType: "audio/wav" });

    if (error) {
      return NextResponse.json({ error: `Storage upload failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ audioUrl: publicUrl(filePath) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
