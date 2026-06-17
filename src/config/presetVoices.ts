import type { VoiceGender, VoiceStyle } from "@/types";

// Single source of truth for the 8 built-in Gemini TTS preset voices —
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
  { id: "Aoede",  name: "Aoede",  emoji: "🌸", desc: "Warm & melodic feminine",   geminiVoiceName: "Aoede",  avatarUrl: av("Aoede"),  gender: "female",  style: "warm" },
  { id: "Charon", name: "Charon", emoji: "🌑", desc: "Deep & authoritative",       geminiVoiceName: "Charon", avatarUrl: av("Charon"), gender: "male",    style: "dramatic" },
  { id: "Fenrir", name: "Fenrir", emoji: "⚡", desc: "Strong & dynamic masculine", geminiVoiceName: "Fenrir", avatarUrl: av("Fenrir"), gender: "male",    style: "playful" },
  { id: "Kore",   name: "Kore",   emoji: "🌿", desc: "Soft & gentle feminine",     geminiVoiceName: "Kore",   avatarUrl: av("Kore"),   gender: "female",  style: "gentle" },
  { id: "Leda",   name: "Leda",   emoji: "✨", desc: "Clear & bright feminine",    geminiVoiceName: "Leda",   avatarUrl: av("Leda"),   gender: "female",  style: "playful" },
  { id: "Orus",   name: "Orus",   emoji: "🪨", desc: "Steady & rich masculine",    geminiVoiceName: "Orus",   avatarUrl: av("Orus"),   gender: "male",    style: "calm" },
  { id: "Puck",   name: "Puck",   emoji: "🎭", desc: "Playful & energetic",        geminiVoiceName: "Puck",   avatarUrl: av("Puck"),   gender: "neutral", style: "playful" },
  { id: "Zephyr", name: "Zephyr", emoji: "🌬", desc: "Bright & airy neutral",      geminiVoiceName: "Zephyr", avatarUrl: av("Zephyr"), gender: "neutral", style: "calm" },
];
