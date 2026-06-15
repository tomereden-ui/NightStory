import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { synthesizeLine } from "@/lib/services/ttsService";
import { supabase, ensureBuckets } from "@/lib/supabase";

const SAMPLE_TEXT = "Once upon a time, in a cozy little forest, a curious fox looked up at the twinkling stars and smiled.";

const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda", "Orus",
  "Perseus", "Schedar", "Rasalgethi", "Enceladus", "Iapetus", "Umbriel",
  "Algenib", "Achernar", "Gacrux", "Pulcherrima",
];

function storageKey(voice: string) {
  return `voice-samples/gemini_${voice}.wav`;
}

// GET — return map of already-generated sample URLs from Supabase Storage
export async function GET() {
  try {
    await ensureBuckets();
    const { data, error } = await supabase.storage.from("audio").list("voice-samples");
    if (error) {
      return NextResponse.json({ samples: {} });
    }

    const existingFiles = new Set((data ?? []).map((f) => f.name));
    const samples: Record<string, string> = {};
    for (const voice of GEMINI_VOICES) {
      const fileName = `gemini_${voice}.wav`;
      if (existingFiles.has(fileName)) {
        samples[voice] = supabase.storage.from("audio").getPublicUrl(storageKey(voice)).data.publicUrl;
      }
    }
    return NextResponse.json({ samples });
  } catch {
    return NextResponse.json({ samples: {} });
  }
}

// POST { voice: string } — generate one sample and upload to Supabase Storage
export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: { voice: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.voice?.trim()) {
    return NextResponse.json({ error: "No voice specified." }, { status: 400 });
  }

  await ensureBuckets();

  // Generate to a temp file
  const tmpPath = path.join(os.tmpdir(), `voice_sample_${body.voice}_${Date.now()}.wav`);
  try {
    await synthesizeLine(SAMPLE_TEXT, body.voice, geminiKey, tmpPath, undefined, false);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  // Upload to Supabase Storage
  try {
    const buf = fs.readFileSync(tmpPath);
    const key = storageKey(body.voice);
    const { error: uploadErr } = await supabase.storage
      .from("audio")
      .upload(key, buf, { contentType: "audio/wav", upsert: true });

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    const url = supabase.storage.from("audio").getPublicUrl(key).data.publicUrl;
    return NextResponse.json({ url });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
