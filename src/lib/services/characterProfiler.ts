import type { ScriptBlock } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import { pickGeminiVoice, NARRATOR_GEMINI_VOICE, NARRATOR_EL_VOICE_ID } from "@/config/ttsDefaults";

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
  voiceName: string;       // ElevenLabs voice ID
  geminiVoiceName: string; // Gemini prebuilt voice name
  persona: string;         // rich voice direction passed to the TTS engine
  stability: number;       // 0–1: higher = more consistent/calm, lower = more variable/expressive
  style: number;           // 0–1: higher = more stylized/dramatic delivery
}

export async function profileCharacters(
  blocks: ScriptBlock[],
  apiKey: string,
  characterDescriptions?: Record<string, string>,
  characterTypes?: Record<string, string>,
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

  // Build a character roster with visual descriptions + types when available
  const hasDescriptions = characterDescriptions && Object.keys(characterDescriptions).length > 0;
  const characterRoster = characters.map((name) => {
    const desc = characterDescriptions?.[name];
    const type = characterTypes?.[name];
    const parts = [name];
    if (type && type !== "narrator") parts.push(`[${type}]`);
    if (desc) parts.push(`— ${desc}`);
    return parts.join(" ");
  }).join("\n");

  const prompt =
    `You are a voice director for a children's bedtime audio drama (audience: ages 4–10, listening at bedtime).\n` +
    `The target voice quality is professional animation movie acting — think Pixar or Studio Ghibli dubs:\n` +
    `warm, clear, beautifully articulated, emotionally genuine, never harsh or over-performed.\n` +
    `Every character must sound like a skilled voice actor: soft consonants, smooth transitions, natural breath.\n\n` +
    `Characters${hasDescriptions ? " (with visual descriptions to guide voice casting)" : ""}:\n${characterRoster}\n\n` +
    `Script sample:\n${scriptSample}\n\n` +
    `Available voices:\n${voiceList}\n\n` +
    `For EACH character produce:\n` +
    `1. voiceName — choose from the list above (label name only, e.g. "Adam").\n` +
    `   Base your choice on the character's actual role, lines in the script${hasDescriptions ? ", and visual description" : ""}.\n` +
    `   A fox cub or small bird → bright, playful voice (Harry/Elli/Dorothy).\n` +
    `   An elderly grandparent → warm, mature voice (Thomas/Adam).\n` +
    `   A young child → light, energetic voice (Harry/Elli).\n` +
    `2. persona — exactly 1 sentence (max 20 words) telling the TTS engine HOW to speak.\n` +
    `   Derive it from: visual description + how this character speaks in the script + bedtime audience.\n` +
    `   Cover: pace (slow/measured/fast) · pitch (low/mid/high) · emotional tone (warm, curious, playful, etc.).\n` +
    `   For animals: match the creature's size and energy — small/quick animals are higher-pitched and faster.\n` +
    `   Example narrator:     "Slow, low-pitched and warm — soft like a Pixar narrator, pausing at wonder."\n` +
    `   Example child hero:   "Upbeat, mid-high-pitched and bright — breathless and clear like a Disney child."\n` +
    `   Example fox cub:      "Fast, high-pitched and playful — bright squeaky voice, quick and mischievous."\n` +
    `   Example elderly owl:  "Slow, low and gravelly — wise and unhurried, each word deliberate and warm."\n` +
    `   Example grandmother:  "Gentle, mid-low and tender — soft and unhurried like a Ghibli elder grandmother."\n` +
    `3. stability — a number 0.0–1.0 based on how variable this character's emotions are in the script:\n` +
    `   • 0.2–0.4 = highly expressive (excited children, small playful animals, comedic characters)\n` +
    `   • 0.5–0.6 = naturally expressive (most characters)\n` +
    `   • 0.7–0.9 = calm, consistent (narrators, wise elders, large dignified animals)\n` +
    `4. style — a number 0.0–1.0 based on how theatrical this character is in the script:\n` +
    `   • 0.0–0.2 = understated, natural\n` +
    `   • 0.3–0.5 = noticeable personality\n` +
    `   • 0.6–0.8 = strong stylistic expression\n\n` +
    `Rules:\n` +
    `- Narrator uses "Adam" (or "Rachel" if female narrator) with stability 0.75, style 0.1.\n` +
    `- Child characters use "Harry" (boys) or "Elli" (girls) with stability 0.3, style 0.5.\n` +
    `- Small playful animals (fox cub, bird, bunny) use "Elli" or "Harry" with stability 0.3, style 0.6.\n` +
    `- Large/dignified animals (elephant, bear, owl) use "Thomas" or "Dorothy" with stability 0.65, style 0.3.\n` +
    `- Elderly characters use "Thomas" (male) or "Emily" (female) with stability 0.7, style 0.2.\n` +
    `- Each character MUST get a different voice where possible.\n\n` +
    `Return ONLY valid JSON (all keys double-quoted), no markdown:\n` +
    `{ "CharacterName": { "voiceName": "Adam", "persona": "...", "stability": 0.7, "style": 0.1 }, ... }`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    });
    const raw = (geminiText(data))
      .trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed: Record<string, CharacterVoiceProfile> = JSON.parse(raw);

    // Resolve label names → EL voice IDs, validate, and add geminiVoiceName from config
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
      // Assign Gemini voice using name + visual description for better age/type matching
      parsed[char].geminiVoiceName = pickGeminiVoice(char, characterDescriptions?.[char] ?? "");
    }
    return parsed;
  } catch (err) {
    console.warn("[CharacterProfiler] Falling back to defaults:", err);
    return Object.fromEntries(characters.map((c) => [c, fallbackProfile(c, characterDescriptions?.[c])]));
  }
}

function fallbackProfile(characterName: string, visualDescription?: string): CharacterVoiceProfile {
  const hint = `${characterName} ${visualDescription ?? ""}`.toLowerCase();
  if (/narrator|storyteller/.test(hint)) {
    return { voiceName: NARRATOR_EL_VOICE_ID, geminiVoiceName: NARRATOR_GEMINI_VOICE, persona: "Slow, low-pitched and warm — speak with quiet authority and gentle pauses.", stability: 0.75, style: 0.1 };
  }
  if (/\b(child|kid|little|young|girl|boy|cub|puppy|kitten|chick)\b/.test(hint)) {
    return { voiceName: "SOYHLrjzK2X1ezoPC6cr", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Fast, high-pitched and bright — speak with bubbly excitement and natural breathiness.", stability: 0.3, style: 0.5 };
  }
  if (/\b(elderly|elder|grandmother|grandfather|grandma|grandpa|old|aged|wise)\b/.test(hint)) {
    return { voiceName: "GBv7mTt0atIp3Br8iCZE", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Slow, low-pitched and gentle — measured and unhurried, warm with age.", stability: 0.7, style: 0.2 };
  }
  return { voiceName: "21m00Tcm4TlvDq8ikWAM", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Measured, mid-pitched and warm — speak naturally with clear emotional colour.", stability: 0.55, style: 0.25 };
}
