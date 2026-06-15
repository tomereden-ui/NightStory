import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { synthesizeLine } from "@/lib/services/ttsService";

const SAMPLE_DIR = path.join(process.cwd(), "public", "output", "voice-samples");
const SAMPLE_TEXT = "Once upon a time, in a cozy little forest, a curious fox looked up at the twinkling stars and smiled.";

function samplePath(voice: string) {
  return path.join(SAMPLE_DIR, `gemini_${voice}.wav`);
}

function sampleUrl(voice: string) {
  return `/output/voice-samples/gemini_${voice}.wav`;
}

// GET — return map of already-generated sample URLs
export async function GET() {
  const GEMINI_VOICES = [
    "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda", "Orus",
    "Perseus", "Schedar", "Rasalgethi", "Enceladus", "Iapetus", "Umbriel",
    "Algenib", "Achernar", "Gacrux", "Pulcherrima",
  ];

  const samples: Record<string, string> = {};
  for (const voice of GEMINI_VOICES) {
    if (fs.existsSync(samplePath(voice))) {
      samples[voice] = sampleUrl(voice);
    }
  }
  return NextResponse.json({ samples });
}

// POST { voice: string } — generate one sample
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

  fs.mkdirSync(SAMPLE_DIR, { recursive: true });

  const filePath = samplePath(body.voice);
  try {
    await synthesizeLine(SAMPLE_TEXT, body.voice, geminiKey, filePath, undefined, false);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  return NextResponse.json({ url: sampleUrl(body.voice) });
}
