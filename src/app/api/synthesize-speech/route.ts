import { NextRequest, NextResponse } from "next/server";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
}

function getVoiceId(characterName: string): string {
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

  const { text, characterName } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

  const spokenText = text.replace(/\[([^\]]+)\]/g, "").replace(/\s{2,}/g, " ").trim() || text;

  // ── ElevenLabs TTS (preferred) ────────────────────────────────────────────
  if (elKey) {
    const voiceId = getVoiceId(characterName ?? "");
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": elKey },
          body: JSON.stringify({
            text: spokenText,
            model_id: "eleven_multilingual_v2",
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

  // ── Gemini TTS fallback ───────────────────────────────────────────────────
  if (!gemKey) return NextResponse.json({ error: "No TTS provider configured." }, { status: 500 });

  const GEMINI_VOICES: Record<string, string> = {
    narrator: "Charon", child: "Puck", fairy: "Kore", dragon: "Fenrir", elder: "Orbit",
  };
  const voiceName = GEMINI_VOICES[Object.keys(GEMINI_VOICES).find((k) => (characterName ?? "").toLowerCase().includes(k)) ?? ""] ?? "Aoede";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${gemKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: spokenText }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
      }),
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
