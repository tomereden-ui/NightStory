import { NextRequest, NextResponse } from "next/server";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
  assignedVoiceId?: string; // Gemini voice name (Charon, Fenrir, Kore…)
  language?: string;        // ISO 639-1 code from the UI language context
}

const LANG_NAMES: Record<string, string> = {
  en: "English", he: "Hebrew", ar: "Arabic", fr: "French", es: "Spanish",
  de: "German", it: "Italian", pt: "Portuguese", zh: "Chinese",
  ja: "Japanese",
};

// Fallback EL voice derived from English character-name patterns (used only
// when no assignedVoiceId is available and EL is configured).
function getELVoiceId(characterName: string): string {
  const n = (characterName ?? "").toLowerCase();
  if (n === "narrator")                                                     return "pNInz6obpgDQGcFmaJgB"; // Adam
  if (/child|kid|boy|little|young|toby|leo|pip/.test(n))                   return "SOYHLrjzK2X1ezoPC6cr"; // Harry
  if (/girl|mia|lily|luna|fairy|sprite|elf|pixie/.test(n))                 return "MF3mGyEYCl7XYWbV9V6O"; // Elli
  if (/fairy|magic|wizard|witch|enchant|star|moon|dream|nova/.test(n))     return "ThT5KcBeYPX3keUQqHPh"; // Dorothy
  if (/dragon|beast|monster|giant|troll|wolf|bear/.test(n))                return "VR6AewLTigWG4xSOukaG"; // Arnold
  if (/grandpa|grandma|elder|old|wise|sage|king|master/.test(n))           return "GBv7mTt0atIp3Br8iCZE"; // Thomas
  if (/queen|mother|mom|mama/.test(n))                                      return "LcfcDJNUP1GQjkzn1xUU"; // Emily
  return "21m00Tcm4TlvDq8ikWAM"; // Rachel — default
}

// Preset Gemini voice names (assignedVoiceId is one of these).
const GEMINI_PRESET_VOICES = new Set(["Aoede", "Charon", "Fenrir", "Kore", "Leda", "Orus", "Puck", "Zephyr"]);

function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
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

export async function POST(req: NextRequest) {
  const elKey   = process.env.ELEVENLABS_API_KEY;
  const gemKey  = process.env.GEMINI_API_KEY;

  let body: SynthesizeRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const { text, characterName, assignedVoiceId, language = "en" } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

  const spokenText = text.replace(/\[([^\]]+)\]/g, "").replace(/\s{2,}/g, " ").trim() || text;

  // ── ElevenLabs TTS (preferred) ────────────────────────────────────────────
  if (elKey) {
    const voiceId = getELVoiceId(characterName ?? "");
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": elKey },
          body: JSON.stringify({
            text: spokenText,
            model_id: "eleven_multilingual_v2",
            // Passing language_code helps EL use the correct phonetics for non-English
            ...(language && language !== "en" ? { language_code: language } : {}),
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
          }),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`EL TTS ${res.status}: ${errText.slice(0, 200)}`);
      }
      const pcm = Buffer.from(await res.arrayBuffer());
      const wav = pcmToWav(pcm);
      return NextResponse.json({ audioData: wav.toString("base64"), mimeType: "audio/wav", voiceName: voiceId });
    } catch (err) {
      console.error("[synthesize-speech] EL failed:", err);
      if (!gemKey) return NextResponse.json({ error: String(err) }, { status: 500 });
      // fall through to Gemini
    }
  }

  // ── Gemini TTS ────────────────────────────────────────────────────────────
  if (!gemKey) return NextResponse.json({ error: "No TTS provider configured." }, { status: 500 });

  // Use the block's assigned voice directly if it's one of the preset Gemini voices;
  // otherwise fall back to a character-type heuristic.
  const voiceName = (assignedVoiceId && GEMINI_PRESET_VOICES.has(assignedVoiceId))
    ? assignedVoiceId
    : (() => {
        const n = (characterName ?? "").toLowerCase();
        if (n === "narrator") return "Charon";
        if (/child|kid|boy/.test(n)) return "Puck";
        if (/girl|fairy/.test(n)) return "Kore";
        if (/dragon|beast|monster/.test(n)) return "Fenrir";
        return "Aoede";
      })();

  const langName = LANG_NAMES[language] ?? language;
  const systemInstruction = language !== "en"
    ? { parts: [{ text: `Speak in ${langName}.` }] }
    : undefined;

  const basePayload = {
    contents: [{ role: "user", parts: [{ text: spokenText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };
  const requestBody = systemInstruction ? { systemInstruction, ...basePayload } : basePayload;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${gemKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType: string; data: string } | undefined;
    if (!inlineData?.data) throw new Error("No audio in Gemini response");
    const isBuf = Buffer.from(inlineData.data, "base64");
    const wav   = inlineData.mimeType.includes("L16") || inlineData.mimeType.includes("pcm") ? pcmToWav(isBuf) : isBuf;
    return NextResponse.json({ audioData: wav.toString("base64"), mimeType: "audio/wav", voiceName });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
