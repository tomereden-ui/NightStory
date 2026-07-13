import { PRESET_VOICES } from "@/config/presetVoices";
import { HEBREW_VOICE_POOL, type HebrewVoice } from "@/config/hebrewVoices";
import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "@/config/ttsEngines";
import type { Voice, VoiceGender, VoiceStyle } from "@/types";

// Admin-configurable via the Voice Manager "Engine Settings" panel — an
// engine unchecked there stops its voices from being offered for NEW
// assignment here. Fetched once per fetchVoicePool() call, not cached across
// calls, since this only runs on Studio page load / language change, not
// per-line like ttsService.ts's synthesis path.
async function fetchEngineSettings(): Promise<EngineSettings> {
  try {
    const res = await fetch("/api/admin/tts-engine-settings", { cache: "no-store" });
    if (!res.ok) return DEFAULT_ENGINE_SETTINGS;
    const data = (await res.json()) as { settings?: EngineSettings };
    return data.settings ?? DEFAULT_ENGINE_SETTINGS;
  } catch {
    return DEFAULT_ENGINE_SETTINGS;
  }
}

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
  description: p.desc,
  language: "en",
  avatarEmoji: p.emoji,
  avatarUrl: p.avatarUrl,
  geminiVoiceName: p.geminiVoiceName,
}));

function isUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

function familyVoiceToVoice(row: FamilyVoiceRow): Voice {
  const avatarRaw = row.avatar_emoji ?? "🎙";
  const avatarIsUrl = isUrl(avatarRaw);
  return {
    id: row.id,
    name: row.name,
    gender: "neutral",
    style: "warm",
    language: "en",
    avatarEmoji: avatarIsUrl ? "🎙" : avatarRaw,
    avatarUrl: avatarIsUrl ? avatarRaw : undefined,
    elevenLabsId: row.el_voice_id ?? undefined,
    geminiVoiceName: row.gemini_voice_name ?? undefined,
  };
}

// ── Curated Hebrew voices → Voice ────────────────────────────────────────────
// Hebrew stories are voiced by ElevenLabs. ElevenLabs' shared-voice-library
// search reliably returns zero results for language="he" (verified against
// 1000+ voices), so there's no broader "live Hebrew library" to browse —
// HEBREW_VOICE_POOL (voices this account actually owns, hand-verified for
// Hebrew via eleven_v3) is the real pool. Enriched here with each voice's
// previewUrl from the account's own voice list, when available.

interface ELPersonalVoice {
  id: string;
  previewUrl?: string | null;
}

function hebrewVoiceToVoice(v: HebrewVoice, previewUrl?: string): Voice {
  return {
    id: v.id,
    name: v.name,
    gender: v.gender,
    style: v.style,
    language: "he",
    previewUrl,
    avatarEmoji: v.gender === "female" ? "👩" : v.gender === "male" ? "👨" : "🎙",
    elevenLabsId: v.id,
  };
}

async function fetchHebrewLibraryVoices(): Promise<Voice[]> {
  try {
    const res = await fetch("/api/el-voices?mode=personal", { cache: "no-store" });
    if (!res.ok) return HEBREW_VOICE_POOL.map((v) => hebrewVoiceToVoice(v));
    const data = (await res.json()) as { voices?: ELPersonalVoice[] };
    const previewById = new Map((data.voices ?? []).map((v) => [v.id, v.previewUrl ?? undefined]));
    return HEBREW_VOICE_POOL.map((v) => hebrewVoiceToVoice(v, previewById.get(v.id)));
  } catch {
    return HEBREW_VOICE_POOL.map((v) => hebrewVoiceToVoice(v));
  }
}

// Combines the built-in Gemini presets with the family voices created by the
// user (fetched from /api/voices), so the script editor's voice picker offers
// the same catalog shown on the Voices page. For Hebrew stories it also appends
// the EL Hebrew-verified library so characters can be cast to real EL voices.
export async function fetchVoicePool(language?: string): Promise<Voice[]> {
  const engineSettings = await fetchEngineSettings();
  const geminiEnabled = engineSettings.gemini25 || engineSettings.gemini31;

  let base: Voice[] = geminiEnabled ? PRESET_VOICE_POOL : [];
  try {
    const res = await fetch("/api/voices", { cache: "no-store" });
    if (res.ok) {
      const rows = (await res.json()) as FamilyVoiceRow[];
      // Filter out corrupted rows where the name field contains a URL, and
      // respect the engine toggle each row's own backing engine belongs to.
      const valid = rows.filter((r) => {
        if (!r.name?.trim() || isUrl(r.name)) return false;
        if (r.el_voice_id) return engineSettings.elevenlabs;
        if (r.gemini_voice_name) return geminiEnabled;
        return true;
      });
      base = [...base, ...valid.map(familyVoiceToVoice)];
    }
  } catch {
    // keep base as-is
  }

  if (language === "he" && engineSettings.elevenlabs) {
    const hebrew = await fetchHebrewLibraryVoices();
    return [...base, ...hebrew];
  }
  return base;
}
