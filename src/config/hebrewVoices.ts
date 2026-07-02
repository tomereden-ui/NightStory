import type { VoiceGender, VoiceStyle } from "@/types";

export type VoiceAgeGroup = "child" | "young" | "adult" | "elderly";

export interface HebrewVoice {
  /** ElevenLabs voice id — assigned directly to a character for Hebrew stories. */
  id: string;
  name: string;
  gender: VoiceGender;
  ageGroup: VoiceAgeGroup;
  style: VoiceStyle;
}

/**
 * Curated pool of ElevenLabs voices that render Hebrew well via the `eleven_v3`
 * multilingual model. These are the voice ids previously hard-mapped one-to-one
 * from Gemini presets in ttsService's HE_EL_VOICE_MAP — now tagged with their
 * own nature (gender / age / style) so a character can be cast to whichever
 * voice actually fits it, rather than a fixed per-preset slot.
 *
 * This is the pool used for server-side auto-casting of Hebrew stories. The
 * manual picker additionally offers the full live EL Hebrew library
 * (see fetchVoicePool → /api/el-voices?language=he).
 */
export const HEBREW_VOICE_POOL: HebrewVoice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female", ageGroup: "adult",   style: "warm" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella",  gender: "female", ageGroup: "young",   style: "gentle" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",   gender: "female", ageGroup: "young",   style: "playful" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi",   gender: "female", ageGroup: "adult",   style: "dramatic" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",   gender: "male",   ageGroup: "adult",   style: "calm" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male",   ageGroup: "elderly", style: "dramatic" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male",   ageGroup: "young",   style: "playful" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",   gender: "male",   ageGroup: "adult",   style: "warm" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",    gender: "male",   ageGroup: "young",   style: "calm" },
];

export const HEBREW_VOICE_BY_ID: Record<string, HebrewVoice> = Object.fromEntries(
  HEBREW_VOICE_POOL.map((v) => [v.id, v]),
);
