import { NextRequest, NextResponse } from "next/server";
import { VOICE_PRESETS } from "@/config/voicePresets";
import { trackELTts } from "@/lib/usageTracker";

const SAMPLE_TEXTS: Record<string, string> = {
  en: "Once upon a time, in a land filled with stars and moonlight, a little child drifted off to sleep.",
  he: "היה היה פעם אחת, בארץ מלאת כוכבים ואור ירח, ילד קטן נרדם בשלווה.",
  es: "Había una vez, en una tierra llena de estrellas y luz de luna, un niño se quedó dormido.",
  fr: "Il était une fois, dans une terre pleine d'étoiles et de clair de lune, un petit enfant s'endormit.",
  de: "Es war einmal in einem Land voller Sterne und Mondlicht, schlief ein kleines Kind sanft ein.",
  pt: "Era uma vez, numa terra cheia de estrelas e luar, uma criança adormeceu.",
  ar: "كان يا ما كان، في أرض مليئة بالنجوم وضوء القمر، نام طفل صغير بهدوء.",
  ja: "むかしむかし、星と月明かりに満ちた国で、小さな子供がそっと眠りにつきました。",
  it: "C'era una volta, in una terra piena di stelle e chiaro di luna, un bambino si addormentò.",
  hi: "एक बार की बात है, तारों और चाँदनी से भरी एक भूमि में, एक छोटा बच्चा शांति से सो गया।",
};

export async function POST(req: NextRequest) {
  const elKey = process.env.ELEVENLABS_API_KEY;
  if (!elKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured." }, { status: 500 });

  const body = await req.json() as { elVoiceId?: string; presetKey?: string; language?: string };
  const { elVoiceId, presetKey, language = "en" } = body;

  if (!elVoiceId) return NextResponse.json({ error: "elVoiceId is required." }, { status: 400 });
  if (!presetKey) return NextResponse.json({ error: "presetKey is required." }, { status: 400 });

  const preset = VOICE_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return NextResponse.json({ error: "Unknown presetKey." }, { status: 400 });

  const text = SAMPLE_TEXTS[language] ?? SAMPLE_TEXTS.en;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": elKey },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: preset.stability,
        similarity_boost: preset.similarity_boost,
        style: preset.style,
        use_speaker_boost: preset.use_speaker_boost,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `ElevenLabs error: ${err.slice(0, 200)}` }, { status: 500 });
  }

  const buf = await res.arrayBuffer();
  trackELTts(text.length).catch(() => {});
  return NextResponse.json({ audioBase64: Buffer.from(buf).toString("base64"), mimeType: "audio/mpeg" });
}
