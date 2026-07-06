import type { VoiceGender, VoiceStyle } from "@/types";

// Single source of truth for all 24 built-in Gemini TTS preset voices —
// shared by the Voices page ("General" tab), the script editor's voice
// picker, and server-side voice assignment (generate-story, produce-drama),
// so the same catalog is offered and resolved everywhere.
export interface PresetVoiceConfig {
  id: string; // == geminiVoiceName; used as Voice.id / ScriptBlock.assignedVoiceId
  name: string;
  emoji: string;
  desc: string;
  geminiVoiceName: string;
  avatarUrl: string;
  gender: VoiceGender;
  style: VoiceStyle;
}

// Avatars are generated once and stored permanently in Supabase storage.
// The seed endpoint (/api/admin/seed-avatars) generates any missing ones.
const _base = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/voice-avatars`
  : "/api/voices/avatar";
const _ext = process.env.NEXT_PUBLIC_SUPABASE_URL ? ".jpg" : "";
const av = (id: string) => `${_base}/${id}${_ext}`;

export const PRESET_VOICES: PresetVoiceConfig[] = [
  // ── Original 8 ──────────────────────────────────────────────────────────────
  { id: "Aoede",          name: "Aoede",          emoji: "🌸", desc: "Warm & melodic feminine",        geminiVoiceName: "Aoede",          avatarUrl: av("Aoede"),          gender: "female",  style: "warm" },
  { id: "Charon",         name: "Charon",         emoji: "🌑", desc: "Deep & authoritative masculine", geminiVoiceName: "Charon",         avatarUrl: av("Charon"),         gender: "male",    style: "dramatic" },
  { id: "Fenrir",         name: "Fenrir",         emoji: "⚡", desc: "Strong & excitable masculine",   geminiVoiceName: "Fenrir",         avatarUrl: av("Fenrir"),         gender: "male",    style: "playful" },
  { id: "Kore",           name: "Kore",           emoji: "🌿", desc: "Soft & gentle feminine",         geminiVoiceName: "Kore",           avatarUrl: av("Kore"),           gender: "female",  style: "gentle" },
  { id: "Leda",           name: "Leda",           emoji: "✨", desc: "Clear & youthful feminine",      geminiVoiceName: "Leda",           avatarUrl: av("Leda"),           gender: "female",  style: "playful" },
  { id: "Orus",           name: "Orus",           emoji: "🪨", desc: "Steady & rich masculine",        geminiVoiceName: "Orus",           avatarUrl: av("Orus"),           gender: "male",    style: "calm" },
  { id: "Puck",           name: "Puck",           emoji: "🎭", desc: "Playful & upbeat",               geminiVoiceName: "Puck",           avatarUrl: av("Puck"),           gender: "neutral", style: "playful" },
  { id: "Zephyr",         name: "Zephyr",         emoji: "🌬", desc: "Bright & airy neutral",          geminiVoiceName: "Zephyr",         avatarUrl: av("Zephyr"),         gender: "neutral", style: "calm" },

  // ── Extended catalog ─────────────────────────────────────────────────────────
  // Altair/Isonoe: kept as our own catalog ids for backward compatibility (existing
  // stories may already have assignedVoiceId: "Altair"/"Isonoe" saved) but neither
  // is a real Gemini prebuilt voice name -- geminiVoiceName is corrected to the
  // real voice each was already aliased to for Chirp3-HD, by gender match
  // (Isonoe: female/gentle -> Pulcherrima; Altair: male/calm -> Iapetus).
  { id: "Altair",         name: "Altair",         emoji: "🦅", desc: "Firm & direct masculine",        geminiVoiceName: "Iapetus",        avatarUrl: av("Altair"),         gender: "male",    style: "calm" },
  { id: "Autonoe",        name: "Autonoe",        emoji: "🌟", desc: "Bright & lively feminine",       geminiVoiceName: "Autonoe",        avatarUrl: av("Autonoe"),        gender: "female",  style: "playful" },
  { id: "Callirrhoe",     name: "Callirrhoe",     emoji: "🌊", desc: "Easy-going & flowing feminine",  geminiVoiceName: "Callirrhoe",     avatarUrl: av("Callirrhoe"),     gender: "female",  style: "warm" },
  { id: "Despina",        name: "Despina",        emoji: "💫", desc: "Smooth & refined feminine",      geminiVoiceName: "Despina",        avatarUrl: av("Despina"),        gender: "female",  style: "gentle" },
  { id: "Erinome",        name: "Erinome",        emoji: "🔮", desc: "Clear & expressive feminine",    geminiVoiceName: "Erinome",        avatarUrl: av("Erinome"),        gender: "female",  style: "warm" },
  { id: "Gacrux",         name: "Gacrux",         emoji: "🌌", desc: "Mature & gravelly masculine",    geminiVoiceName: "Gacrux",         avatarUrl: av("Gacrux"),         gender: "male",    style: "dramatic" },
  { id: "Isonoe",         name: "Isonoe",         emoji: "🍃", desc: "Smooth & delicate feminine",     geminiVoiceName: "Pulcherrima",    avatarUrl: av("Isonoe"),         gender: "female",  style: "gentle" },
  { id: "Laomedeia",      name: "Laomedeia",      emoji: "🎶", desc: "Upbeat & melodic feminine",      geminiVoiceName: "Laomedeia",      avatarUrl: av("Laomedeia"),      gender: "female",  style: "playful" },
  { id: "Rasalgethi",     name: "Rasalgethi",     emoji: "📖", desc: "Informational & articulate",     geminiVoiceName: "Rasalgethi",     avatarUrl: av("Rasalgethi"),     gender: "male",    style: "dramatic" },
  { id: "Sadachbia",      name: "Sadachbia",      emoji: "🎠", desc: "Lively & spirited",              geminiVoiceName: "Sadachbia",      avatarUrl: av("Sadachbia"),      gender: "neutral", style: "playful" },
  { id: "Sadaltager",     name: "Sadaltager",     emoji: "🎓", desc: "Knowledgeable & measured",       geminiVoiceName: "Sadaltager",     avatarUrl: av("Sadaltager"),     gender: "male",    style: "calm" },
  { id: "Schedar",        name: "Schedar",        emoji: "⚖️", desc: "Even & steady",                  geminiVoiceName: "Schedar",        avatarUrl: av("Schedar"),        gender: "neutral", style: "calm" },
  { id: "Sulafat",        name: "Sulafat",        emoji: "🌺", desc: "Warm & inviting feminine",       geminiVoiceName: "Sulafat",        avatarUrl: av("Sulafat"),        gender: "female",  style: "warm" },
  { id: "Umbriel",        name: "Umbriel",        emoji: "🌙", desc: "Easy-going & mellow masculine",  geminiVoiceName: "Umbriel",        avatarUrl: av("Umbriel"),        gender: "male",    style: "gentle" },
  { id: "Vindemiatrix",   name: "Vindemiatrix",   emoji: "🍇", desc: "Gentle & nurturing feminine",    geminiVoiceName: "Vindemiatrix",   avatarUrl: av("Vindemiatrix"),   gender: "female",  style: "gentle" },
  { id: "Zubenelgenubi",  name: "Zubenelgenubi",  emoji: "☁️", desc: "Casual & relaxed",               geminiVoiceName: "Zubenelgenubi",  avatarUrl: av("Zubenelgenubi"),  gender: "neutral", style: "playful" },

  // ── Added to complete Google's official 30-voice Gemini TTS catalog ──────────
  { id: "Achernar",       name: "Achernar",       emoji: "💎", desc: "Soft & delicate feminine",       geminiVoiceName: "Achernar",       avatarUrl: av("Achernar"),       gender: "female",  style: "gentle" },
  { id: "Achird",         name: "Achird",         emoji: "🤝", desc: "Friendly & approachable masculine", geminiVoiceName: "Achird",      avatarUrl: av("Achird"),         gender: "male",    style: "warm" },
  { id: "Algenib",        name: "Algenib",        emoji: "🎸", desc: "Raspy & gravelly masculine",     geminiVoiceName: "Algenib",        avatarUrl: av("Algenib"),        gender: "male",    style: "dramatic" },
  { id: "Algieba",        name: "Algieba",        emoji: "🧈", desc: "Smooth & polished masculine",    geminiVoiceName: "Algieba",        avatarUrl: av("Algieba"),        gender: "male",    style: "calm" },
  { id: "Alnilam",        name: "Alnilam",        emoji: "🗿", desc: "Firm & assured masculine",       geminiVoiceName: "Alnilam",        avatarUrl: av("Alnilam"),        gender: "male",    style: "calm" },
  { id: "Enceladus",      name: "Enceladus",      emoji: "🌫️", desc: "Breathy & soft-spoken masculine", geminiVoiceName: "Enceladus",     avatarUrl: av("Enceladus"),      gender: "male",    style: "gentle" },
];
