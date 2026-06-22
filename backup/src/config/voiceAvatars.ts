// Person-portrait prompts for each catalog voice, keyed by voice id (mockData VOICES)
// or Gemini preset name (PRESET_VOICES on the Voices page). Used by
// /api/voices/avatar/[voiceId] to generate (and cache) a thumbnail per voice.
export const VOICE_AVATAR_PROMPTS: Record<string, string> = {
  // Story voices (src/lib/mockData.ts VOICES)
  v1: "a warm, kind young woman with gentle eyes and a soft smile, cozy bedtime storyteller",
  v2: "a playful young man with a cheerful grin and bright energetic eyes",
  v3: "a serene, gentle person with calm dreamy eyes, soft androgynous features, storyteller",
  v4: "a gentle young woman with a tender warm smile and soft caring eyes",

  // Voices page presets (Gemini TTS prebuilt voices)
  Aoede: "a warm, melodic young woman with a graceful gentle smile",
  Charon: "a deep-voiced, authoritative older man with a serious composed expression",
  Fenrir: "a strong, dynamic young man with bold energetic eyes and an adventurous expression",
  Kore: "a soft-spoken, gentle young woman with kind tender eyes",
  Leda: "a bright, clear-voiced young woman with a cheerful sparkling expression",
  Orus: "a steady, wise mature man with a calm rich presence",
  Puck: "a playful, energetic young person with a mischievous grin, androgynous features",
  Zephyr: "a bright, airy person with light delicate features and a gentle neutral expression",
};
