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
 * multilingual model. Tagged with their own nature (gender / age / style) so a
 * character can be cast to whichever voice actually fits it.
 *
 * These must be voice ids this ElevenLabs account actually owns (check via
 * GET /v1/voices). The original set here used ElevenLabs' legacy 2023 premade
 * voice ids (Rachel, Bella, Elli, Domi, Adam, Arnold, Antoni, Josh, Sam) —
 * those have since gone stale: querying them no longer errors, but silently
 * returns unrelated voice data, and three of the nine (Charon/Fenrir/Puck)
 * had collapsed onto the exact same underlying voice. Replaced 2026-07-03
 * with ids verified against this account's live voice list.
 *
 * This is the pool used for both server-side auto-casting of Hebrew stories
 * AND the manual picker (see voiceCatalog.fetchHebrewLibraryVoices) — EL's
 * shared-voice-library search for language="he" reliably returns zero
 * results (verified against 1000+ voices), so there is no broader "live
 * Hebrew library" to browse; this curated set is the actual full pool.
 */
export const HEBREW_VOICE_POOL: HebrewVoice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   gender: "female", ageGroup: "adult",   style: "warm" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", ageGroup: "young",   style: "playful" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice",   gender: "female", ageGroup: "adult",   style: "calm" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", ageGroup: "adult",   style: "dramatic" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George",  gender: "male",   ageGroup: "adult",   style: "warm" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male",   ageGroup: "adult",   style: "dramatic" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam",    gender: "male",   ageGroup: "young",   style: "playful" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill",    gender: "male",   ageGroup: "elderly", style: "calm" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian",   gender: "male",   ageGroup: "adult",   style: "gentle" },
];

export const HEBREW_VOICE_BY_ID: Record<string, HebrewVoice> = Object.fromEntries(
  HEBREW_VOICE_POOL.map((v) => [v.id, v]),
);
