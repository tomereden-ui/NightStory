// Person-portrait prompts for each catalog voice, keyed by voice id (mockData VOICES)
// or Gemini preset name (PRESET_VOICES on the Voices page). Used by
// /api/voices/avatar/[voiceId] to generate (and cache) a thumbnail per voice.
export const VOICE_AVATAR_PROMPTS: Record<string, string> = {
  // Story voices (src/lib/mockData.ts VOICES)
  v1: "a warm, kind young woman with gentle eyes and a soft smile, cozy bedtime storyteller",
  v2: "a playful young man with a cheerful grin and bright energetic eyes",
  v3: "a serene, gentle person with calm dreamy eyes, soft androgynous features, storyteller",
  v4: "a gentle young woman with a tender warm smile and soft caring eyes",

  // Voices page presets — original 8
  Aoede:   "a warm, melodic young woman with a graceful gentle smile",
  Charon:  "a deep-voiced, authoritative older man with a serious composed expression",
  Fenrir:  "a strong, dynamic young man with bold energetic eyes and an adventurous expression",
  Kore:    "a soft-spoken, gentle young woman with kind tender eyes",
  Leda:    "a bright, clear-voiced young woman with a cheerful sparkling expression",
  Orus:    "a steady, wise mature man with a calm rich presence",
  Puck:    "a playful, energetic young person with a mischievous grin, androgynous features",
  Zephyr:  "a bright, airy person with light delicate features and a gentle neutral expression",

  // Extended catalog — 16 additional voices
  Altair:         "a firm, composed middle-aged man with sharp focused eyes and a confident bearing",
  Autonoe:        "a bright, lively young woman with sparkling eyes and an enthusiastic smile",
  Callirrhoe:     "an easy-going young woman with a relaxed warm smile and flowing hair",
  Despina:        "a smooth, refined young woman with elegant features and a polished expression",
  Erinome:        "a clear-voiced expressive young woman with vivid eyes and an open joyful face",
  Gacrux:         "a mature, gravelly-voiced older man with weathered features and deep-set knowing eyes",
  Isonoe:         "a delicate, soft-spoken young woman with a serene gentle expression",
  Laomedeia:      "an upbeat, melodic young woman with a bright cheerful smile and lively eyes",
  Rasalgethi:     "an articulate, informational middle-aged man with an intelligent composed look",
  Sadachbia:      "a lively, spirited person with animated features and an expressive playful face",
  Sadaltager:     "a knowledgeable, thoughtful older man with a calm measured expression",
  Schedar:        "a steady, even-tempered person with balanced neutral features and a calm gaze",
  Sulafat:        "a warm, inviting young woman with a nurturing smile and soft welcoming eyes",
  Umbriel:        "an easy-going, mellow young man with a relaxed unhurried expression",
  Vindemiatrix:   "a gentle, nurturing young woman with soft features and a tender caring smile",
  Zubenelgenubi:  "a casual, relaxed person with an open friendly expression and conversational ease",

  // Added to complete Google's official 30-voice Gemini TTS catalog
  Achernar:       "a soft-spoken, delicate young woman with a serene gentle smile",
  Achird:         "a friendly, approachable young man with a warm open grin",
  Algenib:        "a raspy-voiced, weathered man with rugged textured features",
  Algieba:        "a smooth-voiced, polished young man with a composed refined look",
  Alnilam:        "a firm, assured middle-aged man with steady confident eyes",
  Enceladus:      "a soft-spoken, breathy young man with a quiet contemplative expression",
};
