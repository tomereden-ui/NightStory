import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BLUEBELL_VOICE = "Kore"; // soft & gentle feminine — suits a fairy narrator

// Static (pre-generated) versions of Bluebell's 5 questions.
// Generic placeholders are used so audio can be cached and reused across sessions.
export const BLUEBELL_AUDIO_SCRIPTS: Record<string, string> = {
  q1: "Every adventure needs a hero... Who's ours tonight?",
  q2: "Now... where does our hero's world exist?",
  q3: "I can already feel it! Now — who travels alongside our hero?",
  q4: "Magnificent! Now — and this is the most important question of all — what is the funniest, or the scariest thing in our hero's world?",
  q5: "That is magnificent... Last question — when the adventure ends, how should our hero feel?",
};

const QUESTION_KEYS = Object.keys(BLUEBELL_AUDIO_SCRIPTS) as (keyof typeof BLUEBELL_AUDIO_SCRIPTS)[];
const FOLDER = "bluebell-questions";

function storageKey(questionKey: string): string {
  return `${FOLDER}/${questionKey}.wav`;
}

function pcmToWav(pcmBase64: string): Buffer {
  const pcm = Buffer.from(pcmBase64, "base64");
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLen = pcm.length;
  const wav = Buffer.alloc(44 + dataLen);
  let o = 0;
  wav.write("RIFF", o); o += 4;
  wav.writeUInt32LE(36 + dataLen, o); o += 4;
  wav.write("WAVE", o); o += 4;
  wav.write("fmt ", o); o += 4;
  wav.writeUInt32LE(16, o); o += 4;
  wav.writeUInt16LE(1, o); o += 2;
  wav.writeUInt16LE(numChannels, o); o += 2;
  wav.writeUInt32LE(sampleRate, o); o += 4;
  wav.writeUInt32LE(byteRate, o); o += 4;
  wav.writeUInt16LE(blockAlign, o); o += 2;
  wav.writeUInt16LE(bitsPerSample, o); o += 2;
  wav.write("data", o); o += 4;
  wav.writeUInt32LE(dataLen, o); o += 4;
  pcm.copy(wav, o);
  return wav;
}

async function generateTTS(apiKey: string, text: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: BLUEBELL_VOICE } } },
    },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if ((res.status === 500 || res.status === 503) && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini TTS ${res.status}`);
      const json = await res.json();
      const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType: string; data: string } | undefined;
      if (!inlineData?.data) throw new Error("No audio in Gemini response");
      const { mimeType, data } = inlineData;
      return mimeType.includes("L16") || mimeType.includes("pcm") ? pcmToWav(data) : Buffer.from(data, "base64");
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error("TTS failed after 3 attempts");
}

// GET — returns existing audio URLs + list of missing question keys
export async function GET() {
  await ensureBuckets();
  const { data: files } = await supabase.storage.from("audio").list(FOLDER);
  const existingNames = new Set((files ?? []).map((f) => f.name));

  const existingAudioUrls: Record<string, string> = {};
  const missing: string[] = [];

  for (const key of QUESTION_KEYS) {
    const fileName = `${key}.wav`;
    if (existingNames.has(fileName)) {
      existingAudioUrls[key] = supabase.storage.from("audio").getPublicUrl(storageKey(key)).data.publicUrl;
    } else {
      missing.push(key);
    }
  }

  return NextResponse.json({ missing, existingAudioUrls });
}

// POST ?key=q1 — generate TTS for one question and cache it in Supabase
export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !BLUEBELL_AUDIO_SCRIPTS[key]) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  await ensureBuckets();

  try {
    const wavBuf = await generateTTS(geminiKey, BLUEBELL_AUDIO_SCRIPTS[key]);
    const { error } = await supabase.storage
      .from("audio")
      .upload(storageKey(key), wavBuf, { contentType: "audio/wav", upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const url = supabase.storage.from("audio").getPublicUrl(storageKey(key)).data.publicUrl;
    return NextResponse.json({ ok: true, key, url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
