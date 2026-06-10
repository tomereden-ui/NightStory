import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
}

// ─── Voice & persona selection ─────────────────────────────────────────────
// Maps character archetype → best Gemini prebuilt voice + system instruction
// that shapes the vocal performance (tone, pacing, emotion).

interface VoiceProfile {
  voiceName: string;
  persona: string;
}

function getVoiceProfile(characterName: string): VoiceProfile {
  const n = characterName.toLowerCase();

  // Narrator — calm, warm storytelling
  if (n === "narrator") {
    return {
      voiceName: "Charon",
      persona:
        "You are a beloved bedtime story narrator. Read with a soft, warm, unhurried voice — " +
        "like a parent reading to a child they adore. Paint vivid images with gentle emphasis. " +
        "Never rush. Let each sentence breathe.",
    };
  }

  // Child / young hero character
  if (/child|kid|boy|girl|little|young|pixel|toby|mia|leo|lily|pip/.test(n)) {
    return {
      voiceName: "Puck",
      persona:
        "You are voicing a child character in a bedtime story. Sound genuinely bright, curious " +
        "and full of wonder — light, playful, slightly breathless with excitement. " +
        "Be natural, not performed.",
    };
  }

  // Fairy / magical / mystical creature
  if (/fairy|faerie|sprite|elf|pixie|nova|magic|wizard|witch|enchant|star|moon|dream/.test(n)) {
    return {
      voiceName: "Kore",
      persona:
        "You are voicing a magical being in a children's story. Speak with a gentle, ethereal quality — " +
        "otherworldly yet warm and kind. Let your voice feel like starlight: soft, clear, a little " +
        "mysterious but never scary.",
    };
  }

  // Dragon / creature / beast
  if (/dragon|beast|monster|giant|troll|wolf|bear/.test(n)) {
    return {
      voiceName: "Fenrir",
      persona:
        "You are voicing a creature character in a children's bedtime story. Sound vivid and characterful — " +
        "rumbling and expressive, but NOT frightening. This is a gentle story; keep warmth even in " +
        "dramatic moments.",
    };
  }

  // Wise elder / grandparent / mentor
  if (/grandpa|grandma|elder|old|wise|sage|king|queen|master/.test(n)) {
    return {
      voiceName: "Orbit",
      persona:
        "You are voicing a wise elder in a children's story. Speak with measured warmth and quiet " +
        "authority — unhurried, thoughtful, carrying the weight of lived experience. " +
        "Each word should feel deliberate and comforting.",
    };
  }

  // Default female character
  return {
    voiceName: "Aoede",
    persona:
      "You are a character in a children's bedtime story. Speak naturally, warmly, and " +
      "expressively — full of personality, gentle in delivery. Sound like a real person, " +
      "not a robot.",
  };
}

// ─── PCM → WAV conversion (Gemini TTS returns raw 16-bit PCM) ──────────────

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
  wav.writeUInt16LE(1, o); o += 2;         // PCM
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

// ─── Route handler ──────────────────────────────────────────────────────────

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // gemini-2.5-flash-preview-tts is the dedicated speech model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-tts",
      systemInstruction: profile.persona,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: profile.voiceName },
          },
        },
      } as Record<string, unknown>,
    });

    const part = result.response.candidates?.[0]?.content?.parts?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inlineData = (part as any)?.inlineData as
      | { mimeType: string; data: string }
      | undefined;

    if (!inlineData?.data) {
      return NextResponse.json({ error: "No audio returned from Gemini." }, { status: 502 });
    }

    // Convert PCM to WAV if needed, otherwise return audio/wav as-is
    let audioBase64: string;
    let mimeType = "audio/wav";

    if (inlineData.mimeType.includes("L16") || inlineData.mimeType.includes("pcm")) {
      const wavBuf = pcmToWav(inlineData.data);
      audioBase64 = wavBuf.toString("base64");
    } else {
      audioBase64 = inlineData.data;
      mimeType = inlineData.mimeType;
    }

    return NextResponse.json({
      audioData: audioBase64,
      mimeType,
      voiceName: profile.voiceName,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
