export const VOICE_PRESETS = [
  { key: "calm_narrator", label: "Option 1", emoji: "📖", description: "Steady and warm — a good all-purpose narration voice",   previewTag: "[warmly]",   stability: 0.50, similarity_boost: 0.85, style: 0.15, speed: 0.92, use_speaker_boost: true },
  { key: "adventure",     label: "Option 2", emoji: "⚔️", description: "More energy and excitement in the delivery",             previewTag: "[excited]",  stability: 0.00, similarity_boost: 0.75, style: 0.75, speed: 1.15, use_speaker_boost: true },
  { key: "whisper",       label: "Option 3", emoji: "🌙", description: "Soft and hushed — good for quiet, sleepy moments",       previewTag: "[whispers]", stability: 1.00, similarity_boost: 0.80, style: 0.00, speed: 0.75, use_speaker_boost: false },
  { key: "warm_tender",   label: "Option 4", emoji: "🫶", description: "Gentle and tender, slower and reassuring",               previewTag: "[gently]",   stability: 0.50, similarity_boost: 0.90, style: 0.30, speed: 0.85, use_speaker_boost: true },
  { key: "playful",       label: "Option 5", emoji: "🎭", description: "Lively and expressive, with more character",            previewTag: "[playfully]",stability: 0.00, similarity_boost: 0.70, style: 0.90, speed: 1.10, use_speaker_boost: true },
] as const;

export type VoicePresetKey = typeof VOICE_PRESETS[number]["key"];
export type VoicePreset = typeof VOICE_PRESETS[number];
export const DEFAULT_PRESET_KEY: VoicePresetKey = "calm_narrator";
