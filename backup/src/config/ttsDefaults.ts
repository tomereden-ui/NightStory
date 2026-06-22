// ── Narrator voice ────────────────────────────────────────────────────────────
// Change NARRATOR_GEMINI_VOICE here to update the narrator across all productions.
export const NARRATOR_GEMINI_VOICE = "Zephyr";

// ── Gemini voice rules (first match wins) ─────────────────────────────────────
const GEMINI_VOICE_RULES: Array<{ match: RegExp; voice: string }> = [
  { match: /narrator|storyteller/i,       voice: NARRATOR_GEMINI_VOICE },
  { match: /grandma|grandmother|granny/i, voice: "Aoede"  },
  { match: /grandpa|grandfather|gramps/i, voice: "Orus"   },
  { match: /elder|wise|old/i,             voice: "Orus"   },
  { match: /child|kid|little|young|boy/i, voice: "Puck"   },
  { match: /girl/i,                       voice: "Kore"   },
  { match: /woman|female|she|her/i,       voice: "Kore"   },
  { match: /man|male|he|him/i,            voice: "Fenrir" },
];

const GEMINI_DEFAULT_VOICE = "Aoede";

export function pickGeminiVoice(characterName: string, voiceStyle = ""): string {
  const hint = characterName + " " + voiceStyle;
  for (const { match, voice } of GEMINI_VOICE_RULES) {
    if (match.test(hint)) return voice;
  }
  return GEMINI_DEFAULT_VOICE;
}

// ── ElevenLabs voice IDs ──────────────────────────────────────────────────────
export const NARRATOR_EL_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam
