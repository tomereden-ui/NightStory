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
  persona: string;      // rich voice direction passed to the TTS engine
  stability: number;    // 0–1: higher = more consistent/calm, lower = more variable/expressive
  style: number;        // 0–1: higher = more stylized/dramatic delivery
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
    .slice(0, 30)
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n");

  const voiceList = AVAILABLE_VOICES.map((v) => `- "${v.label}": ${v.desc}`).join("\n");

  const prompt =
    `You are a voice director for a children's bedtime audio drama (audience: ages 4–10, listening at bedtime).\n` +
    `Study the script sample and cast each character. All voices must feel warm, safe, and gentle — even playful\n` +
    `or energetic characters should never sound harsh or frightening.\n\n` +
    `Characters: ${characters.join(", ")}\n\n` +
    `Script sample:\n${scriptSample}\n\n` +
    `Available voices:\n${voiceList}\n\n` +
    `For EACH character produce:\n` +
    `1. voiceName — choose from the list above (label name only, e.g. "Adam").\n` +
    `   Base your choice on the character's actual role and lines in the script.\n` +
    `2. persona — exactly 1 sentence (max 20 words) telling the TTS engine HOW to speak.\n` +
    `   Derive it from: how this character speaks in the script + their role in the story + the bedtime audience.\n` +
    `   Cover: pace (slow/measured/fast) · pitch (low/mid/high) · emotional tone (e.g. warm, curious, tender, playful).\n` +
    `   Example narrator: "Slow, low-pitched and warm — speak with gentle authority, pausing at wonder moments."\n` +
    `   Example child hero: "Upbeat, mid-pitched and curious — speak with bright energy and genuine surprise."\n` +
    `   Example wise elder: "Measured, low-pitched and tender — speak softly as if sharing a precious secret."\n` +
    `3. stability — a number 0.0–1.0 based on how variable this character's emotions are in the script:\n` +
    `   • 0.2–0.4 = highly expressive (excited children, comedic characters)\n` +
    `   • 0.5–0.6 = naturally expressive (most characters)\n` +
    `   • 0.7–0.9 = calm, consistent (narrators, wise elders)\n` +
    `4. style — a number 0.0–1.0 based on how theatrical this character is in the script:\n` +
    `   • 0.0–0.2 = understated, natural\n` +
    `   • 0.3–0.5 = noticeable personality\n` +
    `   • 0.6–0.8 = strong stylistic expression\n\n` +
    `Rules:\n` +
    `- Narrator uses "Adam" (or "Rachel" if female narrator) with stability 0.75, style 0.1.\n` +
    `- Child characters use "Harry" (boys) or "Elli" (girls) with stability 0.3, style 0.5.\n` +
    `- Each character MUST get a different voice where possible.\n\n` +
    `Return ONLY valid JSON (all keys double-quoted), no markdown:\n` +
    `{ "CharacterName": { "voiceName": "Adam", "persona": "...", "stability": 0.7, "style": 0.1 }, ... }`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192, responseMimeType: "application/json" },
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

    // Resolve label names → EL voice IDs and validate
    const labelToId = Object.fromEntries(AVAILABLE_VOICES.map((v) => [v.label.toLowerCase(), v.name]));
    const validIds  = new Set(AVAILABLE_VOICES.map((v) => v.name));
    for (const char of characters) {
      const entry = parsed[char];
      if (!entry) { parsed[char] = fallbackProfile(char); continue; }
      const resolved = labelToId[entry.voiceName.toLowerCase()];
      if (resolved) {
        parsed[char].voiceName = resolved;
      } else if (!validIds.has(entry.voiceName)) {
        parsed[char] = fallbackProfile(char);
      }
      // Clamp numeric fields
      parsed[char].stability = Math.min(1, Math.max(0, parsed[char].stability ?? 0.55));
      parsed[char].style     = Math.min(1, Math.max(0, parsed[char].style     ?? 0.2));
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
    return { voiceName: "pNInz6obpgDQGcFmaJgB", persona: "Slow, low-pitched and warm — speak with quiet authority and gentle pauses.", stability: 0.75, style: 0.1 };
  }
  if (/child|kid|little|young/.test(name)) {
    return { voiceName: "SOYHLrjzK2X1ezoPC6cr", persona: "Fast, high-pitched and bright — speak with bubbly excitement and natural breathiness.", stability: 0.3, style: 0.5 };
  }
  return { voiceName: "21m00Tcm4TlvDq8ikWAM", persona: "Measured, mid-pitched and warm — speak naturally with clear emotional colour.", stability: 0.55, style: 0.25 };
}
