import { NextRequest, NextResponse } from "next/server";
import { trackELTts, trackGemini, trackGeminiTts } from "@/lib/usageTracker";

// ─── Sample texts ─────────────────────────────────────────────────────────────

const SAMPLE_TEXTS: Record<string, string> = {
  en: "This is me and I will be happy to join your story",
  he: "זה אני, ואשמח להצטרף לסיפור שלך",
  ar: "هذا أنا وسأكون سعيداً بالانضمام إلى قصتك",
  fr: "C'est moi et je serai heureux de rejoindre ton histoire",
  es: "Soy yo y estaré feliz de unirme a tu historia",
  de: "Das bin ich und ich würde mich freuen, an deiner Geschichte teilzunehmen",
  it: "Sono io e sarò felice di unirmi alla tua storia",
  pt: "Sou eu e ficaria feliz em me juntar à sua história",
  ru: "Это я, и я буду рад присоединиться к твоей истории",
  zh: "这是我，我将很乐意加入你的故事",
};

// ─── PCM → WAV helper ────────────────────────────────────────────────────────

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

// ─── Gemini TTS helper ────────────────────────────────────────────────────────

async function callGeminiTTS(
  apiKey: string,
  voiceName: string,
  text: string,
): Promise<{ audioBase64: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = (err as { name?: string }).name === "AbortError";
      if (isTimeout && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      throw new Error(isTimeout ? "Gemini TTS timed out" : `Gemini TTS network error: ${String(err)}`);
    }
    clearTimeout(timer);

    if ((res.status === 500 || res.status === 503) && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 800));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini TTS ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.[0];
    const inlineData = part?.inlineData as { mimeType: string; data: string } | undefined;

    if (!inlineData?.data) {
      throw new Error("No audio data in Gemini response");
    }

    trackGeminiTts(text.length).catch(() => {});
    return { audioBase64: inlineData.data, mimeType: inlineData.mimeType };
  }

  throw new Error("Gemini TTS failed after 3 attempts");
}

// ─── Gemini text model: pick best matching voice ──────────────────────────────

async function pickGeminiVoice(apiKey: string, description: string): Promise<string> {
  const prompt = `From these TTS voices, pick the ONE that best matches: "${description}"

Voices:
- Aoede: warm, melodic, enchanting feminine
- Altair: firm, direct, composed masculine
- Autonoe: bright, lively, energetic feminine
- Callirrhoe: easy-going, flowing, relaxed feminine
- Charon: deep, gravelly, authoritative masculine
- Despina: smooth, refined, polished feminine
- Erinome: clear, expressive, vivid feminine
- Fenrir: strong, excitable, dynamic masculine
- Gacrux: mature, gravelly, seasoned masculine
- Isonoe: smooth, delicate, soft feminine
- Kore: soft, warm, gentle feminine
- Laomedeia: upbeat, melodic, cheerful feminine
- Leda: clear, bright, youthful feminine
- Orus: steady, rich, deep masculine
- Puck: playful, upbeat, energetic neutral
- Rasalgethi: informational, articulate, measured masculine
- Sadachbia: lively, spirited, animated neutral
- Sadaltager: knowledgeable, thoughtful, calm masculine
- Schedar: even, steady, balanced neutral
- Sulafat: warm, inviting, nurturing feminine
- Umbriel: easy-going, mellow, unhurried masculine
- Vindemiatrix: gentle, nurturing, soft feminine
- Zephyr: bright, airy, light neutral
- Zubenelgenubi: casual, relaxed, conversational neutral

Return ONLY the voice name. Nothing else.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini text model error: ${res.status}`);
  }

  const json = await res.json();
  const _t = json.usageMetadata?.totalTokenCount;
  if (_t) trackGemini(_t).catch(() => {});
  const raw: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.trim().split(/\s/)[0];

  const valid = [
    "Aoede", "Altair", "Autonoe", "Callirrhoe", "Charon", "Despina", "Erinome",
    "Fenrir", "Gacrux", "Isonoe", "Kore", "Laomedeia", "Leda", "Orus", "Puck",
    "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel",
    "Vindemiatrix", "Zephyr", "Zubenelgenubi",
  ];
  return valid.includes(cleaned) ? cleaned : "Aoede";
}

// ─── ElevenLabs helpers ───────────────────────────────────────────────────────

async function cloneVoiceEL(
  apiKey: string,
  name: string,
  audioBase64: string,
  audioMimeType: string,
): Promise<string> {
  const audioBuffer = Buffer.from(audioBase64, "base64");
  const ext = audioMimeType.includes("webm")
    ? "webm"
    : audioMimeType.includes("mp4")
    ? "mp4"
    : "wav";
  const blob = new Blob([audioBuffer], { type: audioMimeType });

  const formData = new FormData();
  formData.append("name", name);
  formData.append("files", blob, `recording.${ext}`);

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    // Surface a human-readable message for the missing-permission case
    if (errText.includes("missing_permissions") || errText.includes("create_instant_voice_clone")) {
      throw new Error(
        "Voice cloning requires the Creator plan (or higher) on ElevenLabs. " +
        "Go to elevenlabs.io → Profile → API Keys and make sure your key has the 'Instant Voice Cloning' permission enabled.",
      );
    }
    throw new Error(`ElevenLabs voice clone ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.voice_id) throw new Error("ElevenLabs did not return voice_id");
  return json.voice_id as string;
}

function detectLangFromText(text: string, fallback: string): string | undefined {
  if (/[֐-׿יִ-פֿ]/.test(text)) return "he";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[一-鿿　-ヿ]/.test(text)) return "zh";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (fallback && fallback !== "en") return fallback;
  return undefined;
}

async function ttsEL(apiKey: string, voiceId: string, text: string, language?: string): Promise<string> {
  const langCode = detectLangFromText(text, language ?? "en");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_v3",
      ...(langCode ? { language_code: langCode } : {}),
      voice_settings: { stability: 0.35, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status}: ${errText.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  trackELTts(text.length).catch(() => {});
  return Buffer.from(arrayBuffer).toString("base64");
}

// ─── Route ────────────────────────────────────────────────────────────────────

interface PreviewRequestBody {
  type: "text" | "recorded" | "preset";
  description?: string;
  audioBase64?: string;
  audioMimeType?: string;
  name?: string;
  language?: string;
  sampleText?: string;
  geminiVoiceName?: string;
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const elKey = process.env.ELEVENLABS_API_KEY;

  let body: PreviewRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { type, language = "en" } = body;
  const sampleText = body.sampleText?.trim() || (SAMPLE_TEXTS[language] ?? SAMPLE_TEXTS.en);

  // ── type: "text" — AI picks voice from description, then TTS ────────────────
  if (type === "text") {
    if (!geminiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
    }
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "description is required for type 'text'." }, { status: 400 });
    }

    try {
      const geminiVoiceName = await pickGeminiVoice(geminiKey, body.description);
      const { audioBase64, mimeType } = await callGeminiTTS(geminiKey, geminiVoiceName, sampleText);

      let finalBase64 = audioBase64;
      let finalMime = "audio/wav";
      if (mimeType.includes("L16") || mimeType.includes("pcm")) {
        finalBase64 = pcmToWav(audioBase64).toString("base64");
      } else {
        finalMime = mimeType;
      }

      return NextResponse.json({ audioBase64: finalBase64, mimeType: finalMime, geminiVoiceName });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── type: "preset" — use known geminiVoiceName directly for TTS ──────────────
  if (type === "preset") {
    if (!geminiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
    }
    if (!body.geminiVoiceName?.trim()) {
      return NextResponse.json({ error: "geminiVoiceName is required for type 'preset'." }, { status: 400 });
    }

    try {
      const { audioBase64, mimeType } = await callGeminiTTS(geminiKey, body.geminiVoiceName, sampleText);

      let finalBase64 = audioBase64;
      let finalMime = "audio/wav";
      if (mimeType.includes("L16") || mimeType.includes("pcm")) {
        finalBase64 = pcmToWav(audioBase64).toString("base64");
      } else {
        finalMime = mimeType;
      }

      return NextResponse.json({
        audioBase64: finalBase64,
        mimeType: finalMime,
        geminiVoiceName: body.geminiVoiceName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── type: "recorded" — clone voice via ElevenLabs, then TTS ─────────────────
  if (type === "recorded") {
    if (!elKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured." }, { status: 500 });
    }
    if (!body.audioBase64) {
      return NextResponse.json({ error: "audioBase64 is required for type 'recorded'." }, { status: 400 });
    }

    const voiceName = body.name?.trim() || "My Voice";
    const audioMimeType = body.audioMimeType || "audio/wav";

    try {
      const elVoiceId = await cloneVoiceEL(elKey, voiceName, body.audioBase64, audioMimeType);
      const audioBase64 = await ttsEL(elKey, elVoiceId, sampleText, language);

      return NextResponse.json({ audioBase64, mimeType: "audio/mpeg", elVoiceId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Invalid type. Must be 'text', 'preset', or 'recorded'." },
    { status: 400 },
  );
}
