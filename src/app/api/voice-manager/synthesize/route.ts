import { NextRequest, NextResponse } from "next/server";
import { pcmToWav } from "@/lib/services/ttsService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// NextResponse's BodyInit type doesn't accept Node's Buffer<ArrayBufferLike>
// generic directly — a plain Uint8Array view satisfies it without copying.
function audioResponse(buf: Buffer, contentType: string): NextResponse {
  return new NextResponse(new Uint8Array(buf), { status: 200, headers: { "Content-Type": contentType } });
}

interface SynthesizeBody {
  engine: "elevenlabs" | "gemini";
  voiceId: string;
  text: string;
  /** Detected/selected content language — used for EL's language_code hint only. */
  language?: string;
  params?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speed?: number;
  };
}

// Internal QA tool — a single attempt per request, no retry/backoff. A failure
// should surface immediately so it can be diagnosed, not get silently retried
// away like the production synthesizeLine() path does.

async function synthesizeElevenLabs(body: SynthesizeBody): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured." }, { status: 500 });

  const p = body.params ?? {};
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${body.voiceId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: body.text,
      model_id: "eleven_v3",
      ...(body.language ? { language_code: body.language } : {}),
      ...(p.speed !== undefined ? { speed: p.speed } : {}),
      voice_settings: {
        stability: p.stability ?? 0.5,
        similarity_boost: p.similarityBoost ?? 0.75,
        style: p.style ?? 0,
        use_speaker_boost: p.useSpeakerBoost ?? true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json({ error: `ElevenLabs ${res.status}: ${errText || res.statusText}` }, { status: 502 });
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json({ error: `ElevenLabs returned JSON instead of audio: ${errText}` }, { status: 502 });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return audioResponse(buf, "audio/mpeg");
}

async function synthesizeGemini(body: SynthesizeBody): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: body.text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: body.voiceId } } },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json({ error: `Gemini TTS ${res.status}: ${errText || res.statusText}` }, { status: 502 });
  }

  const json = await res.json();
  const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType?: string; data?: string } | undefined;
  if (!inlineData?.data) {
    return NextResponse.json({ error: `Gemini TTS returned no audio. Full response: ${JSON.stringify(json).slice(0, 500)}` }, { status: 502 });
  }

  const mime = inlineData.mimeType ?? "";
  const lmime = mime.toLowerCase();
  const rawBuf = Buffer.from(inlineData.data, "base64");

  if (lmime.includes("l16") || lmime.includes("pcm")) {
    const rateMatch = mime.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    return audioResponse(pcmToWav(rawBuf, sampleRate), "audio/wav");
  }
  if (lmime.includes("mp3") || lmime.includes("mpeg")) {
    return audioResponse(rawBuf, "audio/mpeg");
  }
  if (lmime.includes("ogg") || lmime.includes("opus")) {
    return audioResponse(rawBuf, "audio/ogg");
  }
  if (lmime.includes("wav")) {
    return audioResponse(rawBuf, "audio/wav");
  }

  // Unknown mime — sniff magic bytes the same way synthesizeGemini() does.
  const isOggMagic = rawBuf[0] === 0x4f && rawBuf[1] === 0x67 && rawBuf[2] === 0x67;
  const isMp3Magic = rawBuf[0] === 0xff && (rawBuf[1] & 0xe0) === 0xe0;
  const isWavMagic = rawBuf.slice(0, 4).toString("ascii") === "RIFF";
  if (isOggMagic) return audioResponse(rawBuf, "audio/ogg");
  if (isMp3Magic) return audioResponse(rawBuf, "audio/mpeg");
  if (isWavMagic) return audioResponse(rawBuf, "audio/wav");

  return NextResponse.json({ error: `Gemini TTS returned an unrecognized audio format (mimeType: "${mime}").` }, { status: 502 });
}

export async function POST(req: NextRequest) {
  let body: SynthesizeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.voiceId || !body.text?.trim()) {
    return NextResponse.json({ error: "voiceId and text are required." }, { status: 400 });
  }

  try {
    if (body.engine === "elevenlabs") return await synthesizeElevenLabs(body);
    if (body.engine === "gemini") return await synthesizeGemini(body);
    return NextResponse.json({ error: `Unknown engine "${body.engine}".` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
