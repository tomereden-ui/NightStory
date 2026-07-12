// Shared engine list for the Voice Manager "Engine Settings" panel and
// everywhere that needs to read/display admin-configured engine on/off state.
// Kept as a plain array (not an enum) so the Voice Manager panel can render
// it directly without duplicating labels.

export type TtsEngine = "gemini25" | "gemini31" | "elevenlabs" | "chirp3hd";

export const TTS_ENGINES: { id: TtsEngine; label: string }[] = [
  { id: "gemini25", label: "Gemini 2.5 Flash TTS" },
  { id: "gemini31", label: "Gemini 3.1 Flash TTS" },
  { id: "elevenlabs", label: "ElevenLabs" },
  { id: "chirp3hd", label: "Google Chirp3-HD" },
];

export type EngineSettings = Record<TtsEngine, boolean>;

// Matches current production behavior exactly (Gemini 2.5 primary, EL for
// Hebrew/family voices, Chirp3-HD as the automatic emergency fallback) —
// used whenever the settings table is empty, unreachable, or the migration
// hasn't been run yet, so nothing changes in production until an admin
// actively opts in via the panel.
export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  gemini25: true,
  gemini31: false,
  elevenlabs: true,
  chirp3hd: true,
};
