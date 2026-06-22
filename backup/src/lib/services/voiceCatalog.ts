import { PRESET_VOICES } from "@/config/presetVoices";
import type { Voice, VoiceGender, VoiceStyle } from "@/types";

interface FamilyVoiceRow {
  id: string;
  name: string;
  gemini_voice_name?: string | null;
  el_voice_id?: string | null;
  avatar_emoji?: string | null;
}

export const PRESET_VOICE_POOL: Voice[] = PRESET_VOICES.map((p) => ({
  id: p.id,
  name: p.name,
  gender: p.gender as VoiceGender,
  style: p.style as VoiceStyle,
  language: "en",
  avatarEmoji: p.emoji,
  avatarUrl: p.avatarUrl,
  geminiVoiceName: p.geminiVoiceName,
}));

function familyVoiceToVoice(row: FamilyVoiceRow): Voice {
  return {
    id: row.id,
    name: row.name,
    gender: "neutral",
    style: "warm",
    language: "en",
    avatarEmoji: row.avatar_emoji ?? "🎙",
    elevenLabsId: row.el_voice_id ?? undefined,
    geminiVoiceName: row.gemini_voice_name ?? undefined,
  };
}

// Combines the built-in Gemini presets with the family voices created by the
// user (fetched from /api/voices), so the script editor's voice picker offers
// the same catalog shown on the Voices page.
export async function fetchVoicePool(): Promise<Voice[]> {
  try {
    const res = await fetch("/api/voices", { cache: "no-store" });
    if (!res.ok) return PRESET_VOICE_POOL;
    const rows = (await res.json()) as FamilyVoiceRow[];
    return [...PRESET_VOICE_POOL, ...rows.map(familyVoiceToVoice)];
  } catch {
    return PRESET_VOICE_POOL;
  }
}
