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

  // Build character roster with visual descriptions and types
  const hasDescriptions = characterDescriptions && Object.keys(characterDescriptions).length > 0;
  const characterRoster = characters.map((name) => {
    const desc = characterDescriptions?.[name];
    const type = characterTypes?.[name];
    const lines = [`CHARACTER: ${name}`];
    if (type) lines.push(`  Type: ${type}`);
    if (desc) lines.push(`  Appearance: ${desc}`);
    return lines.join("\n");
  }).join("\n\n");

  const prompt =
    `You are a Pixar/Ghibli voice casting director for a children's bedtime audio drama (ages 4–10).\n` +
    `Target quality: professional animation voice acting — warm, clear, emotionally genuine, never harsh.\n\n` +
    `════════════ CHARACTERS TO CAST ════════════\n` +
    `${characterRoster}\n\n` +
    `════════════ SCRIPT SAMPLE ════════════\n` +
    `${scriptSample}\n\n` +
    `════════════ AVAILABLE VOICES ════════════\n` +
    `${voiceList}\n\n` +
    `════════════ CASTING INSTRUCTIONS ════════════\n` +
    `For EACH character, do the following research and casting:\n\n` +
    `STEP 1 — ARCHETYPE RESEARCH\n` +
    `Think about what this character IS:\n` +
    (hasDescriptions
      ? `  • Use the visual description to identify the exact archetype (tiny fox cub, wise grandmother, adventurous child, etc.)\n`
      : `  • Infer archetype from the character's name and how they speak in the script\n`) +
    `  • Consider how this archetype is voiced in acclaimed children's animation (Pixar, Ghibli, Disney)\n` +
    `  • Reference specific examples: "A wise elderly owl like Archimedes in The Sword in the Stone…"\n\n` +
    `STEP 2 — VOICE SPECIFICATION\n` +
    `Define EXACTLY how this character should sound:\n` +
    `  • PITCH: very high / high / mid / low / very low\n` +
    `  • PACE: fast/erratic / natural / slow/measured / very slow\n` +
    `  • ENERGY: bouncy/excitable / warm/engaging / calm/steady / weary/deliberate\n` +
    `  • TEXTURE: breathy / clear / raspy / smooth / gravelly\n` +
    `  • KEY TRAIT: the one quality that makes this voice instantly recognisable\n\n` +
    `STEP 3 — CASTING\n` +
    `Choose the best voice from the list and write a 1–2 sentence persona that tells the TTS engine EXACTLY how to perform.\n\n` +
    `CASTING RULES (apply strictly):\n` +
    `- Narrator: "Adam" with stability 0.80, style 0.05. Slow, warm, authoritative.\n` +
    `- Young child characters (human): "Harry" (boys) or "Elli" (girls) — high-pitched, fast, bubbly. Stability 0.25, style 0.55.\n` +
    `- Small playful animals (fox cub, bunny, bird, mouse, puppy): "Harry" or "Elli" — very high-pitched, quick, mischievous. Stability 0.2, style 0.65.\n` +
    `- Large/powerful animals (bear, elephant, lion, dragon): "Arnold" or "Thomas" — deep, rumbling, slow. Stability 0.6, style 0.35.\n` +
    `- Elderly male (grandfather, wizard, old knight): "Thomas" — low, unhurried, grandfatherly. Stability 0.75, style 0.15.\n` +
    `- Elderly female (grandmother, old fairy, elder): "Emily" — soft, gentle, slow. Stability 0.75, style 0.15.\n` +
    `- Young adult female: "Rachel" or "Dorothy" — warm, clear, expressive. Stability 0.5, style 0.35.\n` +
    `- Young adult male: "Arnold" — energetic, bold, clear. Stability 0.45, style 0.4.\n` +
    `- Each character MUST get a DIFFERENT voice from every other character (except Narrator vs others).\n\n` +
    `Return ONLY valid JSON — no markdown, no explanation:\n` +
    `{ "CharacterName": { "voiceName": "Adam", "persona": "...", "stability": 0.8, "style": 0.05 }, ... }`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
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

    // Resolve label names → EL voice IDs, validate, assign Gemini voice from config
    const labelToId = Object.fromEntries(AVAILABLE_VOICES.map((v) => [v.label.toLowerCase(), v.name]));
    const validIds  = new Set(AVAILABLE_VOICES.map((v) => v.name));
    for (const char of characters) {
      const entry = parsed[char];
      if (!entry) { parsed[char] = fallbackProfile(char, characterDescriptions?.[char]); continue; }
      const resolved = labelToId[entry.voiceName.toLowerCase()];
      if (resolved) {
        parsed[char].voiceName = resolved;
      } else if (!validIds.has(entry.voiceName)) {
        parsed[char] = fallbackProfile(char, characterDescriptions?.[char]);
      }
      parsed[char].stability = Math.min(1, Math.max(0, parsed[char].stability ?? 0.55));
      parsed[char].style     = Math.min(1, Math.max(0, parsed[char].style     ?? 0.2));
      // Assign Gemini voice using description for better age/type matching
      parsed[char].geminiVoiceName = pickGeminiVoice(char, characterDescriptions?.[char] ?? "");
    }

    console.log("[CharacterProfiler] cast:", Object.entries(parsed)
      .map(([n, p]) => `${n}→${p.voiceName.slice(0, 6)}/${p.geminiVoiceName}`).join(", "));
    return parsed;
  } catch (err) {
    console.warn("[CharacterProfiler] Falling back to defaults:", err);
    return Object.fromEntries(characters.map((c) => [c, fallbackProfile(c, characterDescriptions?.[c])]));
  }
}

function fallbackProfile(characterName: string, visualDescription?: string): CharacterVoiceProfile {
  const hint = `${characterName} ${visualDescription ?? ""}`.toLowerCase();
  if (/narrator|storyteller/.test(hint)) {
    return { voiceName: NARRATOR_EL_VOICE_ID, geminiVoiceName: NARRATOR_GEMINI_VOICE, persona: "Slow, low-pitched and warm — speak with quiet authority and gentle pauses.", stability: 0.80, style: 0.05 };
  }
  if (/\b(cub|fawn|foal|kitten|puppy|chick|hatchling|baby|tiny|small)\b.*\b(fox|dog|cat|bird|rabbit|bunny|mouse|squirrel|animal)\b/.test(hint)
      || /\b(playful|mischievous)\b.*\b(animal|creature)\b/.test(hint)) {
    return { voiceName: "SOYHLrjzK2X1ezoPC6cr", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Very high-pitched, fast and mischievous — quick bright delivery like a tiny playful animal, irresistibly cute.", stability: 0.2, style: 0.65 };
  }
  if (/\b(child|kid|little|young|girl|boy)\b/.test(hint)) {
    return { voiceName: "SOYHLrjzK2X1ezoPC6cr", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "High-pitched, fast and bright — bubbly excited delivery like a Disney child hero.", stability: 0.25, style: 0.55 };
  }
  if (/\b(elderly|elder|grandmother|grandma|granny|old woman|aged woman)\b/.test(hint)) {
    return { voiceName: "LcfcDJNUP1GQjkzn1xUU", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Slow, soft and gentle — warm grandmotherly pace, every word tender and unhurried.", stability: 0.75, style: 0.15 };
  }
  if (/\b(grandfather|grandpa|gramps|old man|wizard|elder|wise old|aged man)\b/.test(hint)) {
    return { voiceName: "GBv7mTt0atIp3Br8iCZE", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Low, slow and gravelly — wise and deliberate, each word measured like a Ghibli elder.", stability: 0.75, style: 0.15 };
  }
  return { voiceName: "21m00Tcm4TlvDq8ikWAM", geminiVoiceName: pickGeminiVoice(characterName, visualDescription ?? ""), persona: "Measured, mid-pitched and warm — speak naturally with clear emotional colour.", stability: 0.55, style: 0.25 };
}
