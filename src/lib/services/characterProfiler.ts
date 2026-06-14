import type { ScriptBlock } from "@/types";

export const AVAILABLE_VOICES = [
  { name: "pNInz6obpgDQGcFmaJgB", label: "Adam",    desc: "deep, warm baritone male — authoritative, trustworthy narrator quality" },
  { name: "LcfcDJNUP1GQjkzn1xUU", label: "Emily",   desc: "soft, gentle female — nurturing, calm, reassuring" },
  { name: "VR6AewLTigWG4xSOukaG", label: "Arnold",  desc: "strong, bold male — energetic, adventurous, determined" },
  { name: "21m00Tcm4TlvDq8ikWAM", label: "Rachel",  desc: "warm, expressive female — emotional, storyteller quality, heartfelt" },
  { name: "SOYHLrjzK2X1ezoPC6cr", label: "Harry",   desc: "bright, playful young male — child-like, mischievous, light and bouncy" },
  { name: "MF3mGyEYCl7XYWbV9V6O", label: "Elli",    desc: "youthful female — curious, spirited, quick" },
  { name: "GBv7mTt0atIp3Br8iCZE", label: "Thomas",  desc: "measured, mature male — wise elder, deliberate pacing, thoughtful" },
  { name: "ThT5KcBeYPX3keUQqHPh", label: "Dorothy", desc: "airy, light female — ethereal, whimsical, gentle and dreamy" },
];

export interface CharacterVoiceProfile {
  voiceName: string;
  persona: string;
}

export async function profileCharacters(
  blocks: ScriptBlock[],
  apiKey: string,
): Promise<Record<string, CharacterVoiceProfile>> {
  const seen = new Set<string>();
  const characters = blocks.map((b) => b.characterName).filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });

  const scriptSample = blocks
    .slice(0, 24)
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n");

  const voiceList = AVAILABLE_VOICES.map((v) => `- "${v.label}": ${v.desc}`).join("\n");

  const prompt =
    `You are a voice casting director for a children's audio drama.\n\n` +
    `Characters: ${characters.join(", ")}\n\n` +
    `Script sample:\n${scriptSample}\n\n` +
    `Available voices:\n${voiceList}\n\n` +
    `For each character, choose the best-matching voice and write a 1-2 sentence persona.\n\n` +
    `Rules:\n` +
    `- Narrator uses "Adam" unless the story clearly implies a female narrator.\n` +
    `- Child characters use "Harry" (boy) or "Elli" (girl).\n` +
    `- Each character MUST get a different voice where possible.\n\n` +
    `Return ONLY valid JSON (all keys double-quoted), no markdown:\n` +
    `{ "CharacterName": { "voiceName": "Adam", "persona": "..." }, ... }`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: "application/json" },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        }),
      }
    );
    const data = await res.json();
    const raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed: Record<string, CharacterVoiceProfile> = JSON.parse(raw);

    // Resolve label names ("Adam") → EL voice IDs, validate entries
    const labelToId = Object.fromEntries(AVAILABLE_VOICES.map((v) => [v.label.toLowerCase(), v.name]));
    const validIds = new Set(AVAILABLE_VOICES.map((v) => v.name));
    for (const char of characters) {
      const entry = parsed[char];
      if (!entry) { parsed[char] = fallbackProfile(char); continue; }
      // If voiceName is a label, resolve to ID
      const resolved = labelToId[entry.voiceName.toLowerCase()];
      if (resolved) {
        parsed[char].voiceName = resolved;
      } else if (!validIds.has(entry.voiceName)) {
        parsed[char] = fallbackProfile(char);
      }
    }
    return parsed;
  } catch (err) {
    console.warn("[CharacterProfiler] Falling back to defaults:", err);
    return Object.fromEntries(characters.map((c) => [c, fallbackProfile(c)]));
  }
}

function fallbackProfile(characterName: string): CharacterVoiceProfile {
  const name = characterName.toLowerCase();
  if (/narrator|storyteller/.test(name)) {
    return { voiceName: "pNInz6obpgDQGcFmaJgB", persona: "Warm, engaging storyteller. Clear, varied pacing." };
  }
  if (/child|kid|little|young/.test(name)) {
    return { voiceName: "SOYHLrjzK2X1ezoPC6cr", persona: "Lively, curious child. Energetic and enthusiastic." };
  }
  return { voiceName: "21m00Tcm4TlvDq8ikWAM", persona: "Expressive, friendly character. Warm and clear." };
}
