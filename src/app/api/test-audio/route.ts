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

  let body: { type: "tts" | "sfx"; text: string };
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
    const outPath = path.join(OUT_DIR, `test_tts_${id}.wav`);
    try {
      await synthesizeLine(body.text, "Kore", geminiKey, outPath);
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
  const ok = await generateSfx(body.text, 5000, elevenKey, outPath);
  if (!ok) {
    return NextResponse.json({ error: "ElevenLabs SFX generation failed. Check your API key." }, { status: 502 });
  }

  return NextResponse.json({ audioUrl: `/output/test_sfx_${id}.mp3` });
}
