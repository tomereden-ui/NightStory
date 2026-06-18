import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { synthesizeLine } from "@/lib/services/ttsService";
import { generateSfx, writeSilence } from "@/lib/services/sfxService";

const OUT_DIR = path.join(process.cwd(), "public", "output");

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: { type: "tts" | "sfx"; text: string; provider?: "gemini" | "el"; voice?: string; voiceStyle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const id = crypto.randomUUID().slice(0, 8);

  if (body.type === "tts") {
    const useEL = body.provider === "el";
    const elevenKey = process.env.ELEVENLABS_API_KEY ?? null;

    if (useEL && !elevenKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured. Add it to .env.local to use ElevenLabs." }, { status: 500 });
    }

    const apiKey = useEL ? elevenKey! : geminiKey;
    const defaultVoice = useEL ? "pNInz6obpgDQGcFmaJgB" : "Kore";
    const voice = body.voice?.trim() || defaultVoice;

    const rawText = body.text.trim();

    if (useEL) {
      const codes = Array.from(rawText).slice(0, 8).map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}(${c})`);
      console.log("[EL TTS] text sent to EL →", JSON.stringify(rawText));
      console.log("[EL TTS] first chars     →", codes.join(" "));
    }

    // Performance tag prefix carries style hints into the line
    const line = body.voiceStyle?.trim()
      ? `[${body.voiceStyle.trim()}] ${rawText}`
      : rawText;

    const outPath = path.join(OUT_DIR, `test_tts_${id}.wav`);
    try {
      await synthesizeLine(line, voice, apiKey, outPath, undefined, useEL);
    } catch (err) {
      writeSilence(2000, outPath);
      console.warn("[test-audio TTS]", err);
    }
    return NextResponse.json({ audioUrl: `/output/test_tts_${id}.wav` });
  }

  // SFX
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured. Add it to .env.local to test SFX." }, { status: 500 });
  }

  const outPath = path.join(OUT_DIR, `test_sfx_${id}.mp3`);
  const result = await generateSfx(body.text, 5000, elevenKey, outPath);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ audioUrl: `/output/test_sfx_${id}.mp3` });
}
