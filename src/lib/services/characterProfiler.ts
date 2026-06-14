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
    `You are a voice director for a children's audio drama. Study the script and cast each character with a detailed voice profile.\n\n` +
    `Characters: ${characters.join(", ")}\n\n` +
    `Script sample:\n${scriptSample}\n\n` +
    `Available voices:\n${voiceList}\n\n` +
    `For EACH character produce:\n` +
    `1. voiceName — choose from the list above (label name only, e.g. "Adam").\n` +
    `2. persona — a rich, precise voice direction (4–6 sentences) covering:\n` +
    `   - Gender, approximate age, and cultural/language background if evident\n` +
    `   - Personality: is this character confident, shy, curious, wise, mischievous, caring?\n` +
    `   - Voice quality: pitch (high/mid/low), texture (smooth/raspy/breathy/clear), pace (fast/measured/slow)\n` +
    `   - Energy level and emotional mood throughout the story\n` +
    `   - Any distinctive speech patterns visible in their lines (hesitations, exclamations, tenderness)\n` +
    `   - How their delivery should make the listener FEEL\n` +
    `3. stability — a number 0.0–1.0:\n` +
    `   • 0.2–0.4 = highly expressive, variable (excited children, dramatic characters)\n` +
    `   • 0.5–0.6 = naturally expressive (most characters)\n` +
    `   • 0.7–0.9 = calm, consistent (narrators, wise elders, soothing characters)\n` +
    `4. style — a number 0.0–1.0:\n` +
    `   • 0.0–0.2 = understated, natural delivery\n` +
    `   • 0.3–0.5 = noticeable personality and colour\n` +
    `   • 0.6–0.8 = strong stylistic expression (comedic, highly dramatic)\n\n` +
    `Rules:\n` +
    `- Narrator uses "Adam" (or "Rachel" if narrator is female) with stability 0.75, style 0.1.\n` +
    `- Children use "Harry" (boys) or "Elli" (girls) with stability 0.3, style 0.5.\n` +
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
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048, responseMimeType: "application/json" },
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
    return { voiceName: "pNInz6obpgDQGcFmaJgB", persona: "A warm, unhurried bedtime story narrator. Speak with gentle authority and wonder — like a parent reading to a beloved child. Vary your pace to match story tension, slow down at magical moments.", stability: 0.75, style: 0.1 };
  }
  if (/child|kid|little|young/.test(name)) {
    return { voiceName: "SOYHLrjzK2X1ezoPC6cr", persona: "A lively, curious young child. Speak with genuine excitement and natural spontaneity — a little breathless, full of wonder. Let emotions show freely.", stability: 0.3, style: 0.5 };
  }
  return { voiceName: "21m00Tcm4TlvDq8ikWAM", persona: "A warm, expressive character. Speak naturally with personality — let the emotion of each line come through clearly.", stability: 0.55, style: 0.25 };
}
