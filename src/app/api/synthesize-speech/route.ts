import { NextRequest, NextResponse } from "next/server";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
}

// ─── Voice + persona selection ────────────────────────────────────────────────

interface VoiceProfile {
  voiceName: string;
  persona: string;
}

function getVoiceProfile(characterName: string): VoiceProfile {
  const n = (characterName ?? "").toLowerCase();

  if (n === "narrator") {
    return {
      voiceName: "Charon",
      persona: "Speak as a warm, unhurried bedtime story narrator. Use a gentle, soothing tone — like a parent reading to a beloved child. Pace yourself slowly, let each sentence breathe, and convey wonder and calm.",
    };
  }
  if (/child|kid|boy|girl|little|young|pixel|toby|mia|leo|lily|pip/.test(n)) {
    return {
      voiceName: "Puck",
      persona: "Speak as a bright, curious child character. Sound genuinely playful and full of wonder — light, a little breathless with excitement. Be natural and spontaneous.",
    };
  }
  if (/fairy|faerie|sprite|elf|pixie|nova|magic|wizard|witch|enchant|star|moon|dream/.test(n)) {
    return {
      voiceName: "Kore",
      persona: "Speak as an ethereal, magical being. Your voice should feel soft and otherworldly — gentle and warm, with a hint of mystery. Never scary, always kind.",
    };
  }
  if (/dragon|beast|monster|giant|troll|wolf|bear/.test(n)) {
    return {
      voiceName: "Fenrir",
      persona: "Speak as a vivid creature character in a children's story. Sound expressive and characterful — rumbling, but NOT frightening. Keep warmth even in dramatic moments.",
    };
  }
  if (/grandpa|grandma|elder|old|wise|sage|king|queen|master/.test(n)) {
    return {
      voiceName: "Orbit",
      persona: "Speak as a wise, measured elder. Your voice carries quiet authority and warmth — unhurried, thoughtful, like someone who has lived many wonderful stories.",
    };
  }
  return {
    voiceName: "Aoede",
    persona: "Speak as a warm, expressive character in a children's bedtime story. Sound natural and full of personality — gentle, clear, and engaging.",
  };
}

// ─── PCM → WAV helper (Gemini TTS returns raw 16-bit PCM at 24 kHz) ──────────

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

// ─── Direct REST call with retry ─────────────────────────────────────────────

async function callGeminiTTS(
  apiKey: string,
  model: string,
  promptText: string,
  voiceName: string,
): Promise<{ audioBase64: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
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
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 800));
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini TTS ${res.status}: ${err.slice(0, 200)}`);
    }

    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.[0];
    const inlineData = part?.inlineData as { mimeType: string; data: string } | undefined;

    console.log("[TTS] candidate part keys:", part ? Object.keys(part) : "none");
    console.log("[TTS] inlineData mimeType:", inlineData?.mimeType, "data length:", inlineData?.data?.length ?? 0);

    if (!inlineData?.data) {
      console.error("[TTS] Full response:", JSON.stringify(json).slice(0, 500));
      throw new Error("No audio data in Gemini response");
    }

    return { audioBase64: inlineData.data, mimeType: inlineData.mimeType };
  }

  throw new Error("Gemini TTS failed after 3 attempts");
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: SynthesizeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { text, characterName } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  const profile = getVoiceProfile(characterName ?? "");

  // Embed persona as a speaking instruction in the prompt itself
  // (TTS models don't support systemInstruction)
  const promptText = `[${profile.persona}]\n\n${text}`;

  try {
    const { audioBase64, mimeType } = await callGeminiTTS(
      apiKey,
      "gemini-2.5-flash-preview-tts",
      promptText,
      profile.voiceName,
    );

    // Convert PCM to WAV if the model returned raw audio
    let finalBase64 = audioBase64;
    let finalMime = "audio/wav";

    if (mimeType.includes("L16") || mimeType.includes("pcm")) {
      finalBase64 = pcmToWav(audioBase64).toString("base64");
    } else {
      finalMime = mimeType;
    }

    console.log("[TTS] Returning mimeType:", finalMime, "base64 length:", finalBase64.length);
    return NextResponse.json({
      audioData: finalBase64,
      mimeType: finalMime,
      voiceName: profile.voiceName,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
