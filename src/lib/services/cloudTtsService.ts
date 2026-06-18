import fs from "fs";

// Google Cloud Text-to-Speech — stable production API, no preview quota limits.
// Requires GOOGLE_CLOUD_TTS_API_KEY with "Cloud Text-to-Speech API" enabled in
// the same Google Cloud project.

export interface CloudTtsVoice {
  id: string;          // e.g. "en-US-Neural2-D"
  label: string;       // display name
  languageCode: string; // e.g. "en-US"
  gender: "MALE" | "FEMALE" | "NEUTRAL";
  tier: "Neural2" | "Studio" | "Wavenet";
}

// Curated voice list — enough variety to compare quality vs Gemini TTS.
export const CLOUD_TTS_VOICES: CloudTtsVoice[] = [
  // English
  { id: "en-US-Neural2-D", label: "Neural2 · D (EN)",  languageCode: "en-US", gender: "MALE",   tier: "Neural2" },
  { id: "en-US-Neural2-F", label: "Neural2 · F (EN)",  languageCode: "en-US", gender: "FEMALE", tier: "Neural2" },
  { id: "en-US-Neural2-A", label: "Neural2 · A (EN)",  languageCode: "en-US", gender: "FEMALE", tier: "Neural2" },
  { id: "en-US-Neural2-J", label: "Neural2 · J (EN)",  languageCode: "en-US", gender: "MALE",   tier: "Neural2" },
  // Hebrew
  { id: "he-IL-Neural2-A", label: "Neural2 · A (HE)",  languageCode: "he-IL", gender: "FEMALE", tier: "Neural2" },
  { id: "he-IL-Neural2-B", label: "Neural2 · B (HE)",  languageCode: "he-IL", gender: "MALE",   tier: "Neural2" },
  { id: "he-IL-Neural2-C", label: "Neural2 · C (HE)",  languageCode: "he-IL", gender: "FEMALE", tier: "Neural2" },
  { id: "he-IL-Neural2-D", label: "Neural2 · D (HE)",  languageCode: "he-IL", gender: "MALE",   tier: "Neural2" },
];

export async function synthesizeCloudTts(
  text: string,
  voiceId: string,
  apiKey: string,
  outputPath: string,
): Promise<void> {
  const voice = CLOUD_TTS_VOICES.find((v) => v.id === voiceId) ?? CLOUD_TTS_VOICES[0];

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: voice.languageCode, name: voiceId },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloud TTS ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { audioContent: string };
  if (!data.audioContent) throw new Error("Cloud TTS: no audio in response");

  fs.writeFileSync(outputPath, Buffer.from(data.audioContent, "base64"));
}
