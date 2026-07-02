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

// ── ElevenLabs Hebrew library → Voice ───────────────────────────────────────────
// Hebrew stories are voiced by ElevenLabs, so the picker lists real EL voices
// verified for Hebrew. These carry language "he" (used to group them in the
// picker) and elevenLabsId, so an assigned id resolves for display and plays
// directly through the EL path.

interface ELLibraryVoice {
  id: string;
  name: string;
  labels?: Record<string, string>;
  previewUrl?: string | null;
}

function elGender(labels: Record<string, string> = {}): VoiceGender {
  const g = (labels.gender ?? "").toLowerCase();
  if (g.includes("female")) return "female";
  if (g.includes("male")) return "male";
  return "neutral";
}

function elStyle(labels: Record<string, string> = {}): VoiceStyle {
  const tags = `${labels.descriptive ?? ""} ${labels.use_case ?? ""} ${labels.description ?? ""}`.toLowerCase();
  if (/calm|meditat|soothing|relax/.test(tags)) return "calm";
  if (/soft|gentle|whisper|tender/.test(tags)) return "gentle";
  if (/character|animation|playful|energetic|excit/.test(tags)) return "playful";
  if (/dramatic|deep|intense|bold|narration|narrative|audiobook/.test(tags)) return "dramatic";
  return "warm";
}

function elLibraryToVoice(v: ELLibraryVoice): Voice {
  const gender = elGender(v.labels);
  return {
    id: v.id,
    name: v.name,
    gender,
    style: elStyle(v.labels),
    language: "he",
    previewUrl: v.previewUrl ?? undefined,
    avatarEmoji: gender === "female" ? "👩" : gender === "male" ? "👨" : "🎙",
    elevenLabsId: v.id,
  };
}

async function fetchHebrewLibraryVoices(): Promise<Voice[]> {
  try {
    const res = await fetch("/api/el-voices?mode=library&language=he&page_size=40", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { voices?: ELLibraryVoice[] };
    return (data.voices ?? []).map(elLibraryToVoice);
  } catch {
    return [];
  }
}

// Combines the built-in Gemini presets with the family voices created by the
// user (fetched from /api/voices), so the script editor's voice picker offers
// the same catalog shown on the Voices page. For Hebrew stories it also appends
// the EL Hebrew-verified library so characters can be cast to real EL voices.
export async function fetchVoicePool(language?: string): Promise<Voice[]> {
  let base: Voice[] = PRESET_VOICE_POOL;
  try {
    const res = await fetch("/api/voices", { cache: "no-store" });
    if (res.ok) {
      const rows = (await res.json()) as FamilyVoiceRow[];
      // Filter out corrupted rows where the name field contains a URL
      const valid = rows.filter((r) => r.name?.trim() && !isUrl(r.name));
      base = [...PRESET_VOICE_POOL, ...valid.map(familyVoiceToVoice)];
    }
  } catch {
    base = PRESET_VOICE_POOL;
  }

  if (language === "he") {
    const hebrew = await fetchHebrewLibraryVoices();
    return [...base, ...hebrew];
  }
  return base;
}
