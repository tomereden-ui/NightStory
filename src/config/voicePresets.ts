export const VOICE_PRESETS = [
  { key: "calm_narrator", label: "Calm Narrator",      emoji: "📖", description: "Comforting, warm, steady — the default bedtime voice",         stability: 0.60, similarity_boost: 0.80, style: 0.20, speed: 0.90, use_speaker_boost: true },
  { key: "adventure",     label: "Adventure",           emoji: "⚔️", description: "Excited, dynamic — action, surprises, silly twists",          stability: 0.40, similarity_boost: 0.80, style: 0.45, speed: 1.00, use_speaker_boost: true },
  { key: "whisper",       label: "Whisper",             emoji: "🌙", description: "Soft and slow — endings, secrets, falling asleep",             stability: 0.68, similarity_boost: 0.80, style: 0.10, speed: 0.82, use_speaker_boost: true },
  { key: "warm_tender",   label: "Warm & Tender",       emoji: "🫶", description: "Comforting moments, reassurance, emotional beats",             stability: 0.62, similarity_boost: 0.85, style: 0.15, speed: 0.85, use_speaker_boost: true },
  { key: "playful",       label: "Playful Character",   emoji: "🎭", description: "Mischievous side-character — comic relief, high energy",       stability: 0.35, similarity_boost: 0.75, style: 0.50, speed: 1.05, use_speaker_boost: true },
] as const;

export type VoicePresetKey = typeof VOICE_PRESETS[number]["key"];
export type VoicePreset = typeof VOICE_PRESETS[number];
export const DEFAULT_PRESET_KEY: VoicePresetKey = "calm_narrator";
