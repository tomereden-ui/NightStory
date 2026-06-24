// ── Narrator voice ────────────────────────────────────────────────────────────
export const NARRATOR_GEMINI_VOICE = "Zephyr";

// ── Gemini voice rules — checked against (characterName + visualDescription), first match wins ──
// Ordered from most specific to least specific.
const GEMINI_VOICE_RULES: Array<{ match: RegExp; voice: string }> = [
  // Role
  { match: /narrator|storyteller/i,                                    voice: NARRATOR_GEMINI_VOICE },
  // Age/type from visual description
  { match: /\b(cub|fawn|foal|kitten|puppy|chick|hatchling|baby)\b/i,  voice: "Leda"   }, // youthful
  { match: /\b(elderly|elder|grandmother|grandma|granny|aged|old)\b/i, voice: "Gacrux" }, // mature
  { match: /\b(grandfather|grandpa|gramps|old man|old wizard)\b/i,     voice: "Orus"   }, // mature male
  { match: /\b(child|girl|young girl|little girl)\b/i,                 voice: "Kore"   }, // young female
  { match: /\b(boy|young boy|little boy)\b/i,                          voice: "Puck"   }, // young male
  // Animal energy from description
  { match: /\b(tiny|small|little|playful|mischievous|quick)\b.*(animal|fox|bird|bunny|rabbit|mouse|squirrel)/i, voice: "Fenrir" }, // excitable small animal
  { match: /\b(large|big|great|mighty|ancient|dignified)\b.*(bear|elephant|lion|whale|dragon)/i,               voice: "Orus"   }, // deep large animal
  // Generic gender fallbacks
  { match: /\bwoman|female\b/i, voice: "Kore"   },
  { match: /\bman|male\b/i,     voice: "Fenrir" },
];

const GEMINI_DEFAULT_VOICE = "Aoede";

export function pickGeminiVoice(characterName: string, visualDescription = ""): string {
  const hint = `${characterName} ${visualDescription}`;
  for (const { match, voice } of GEMINI_VOICE_RULES) {
    if (match.test(hint)) return voice;
  }
  return GEMINI_DEFAULT_VOICE;
}

// ── ElevenLabs voice IDs ──────────────────────────────────────────────────────
export const NARRATOR_EL_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam
