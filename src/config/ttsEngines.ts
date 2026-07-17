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

// Ordered synthesis priority — 1 = default/primary engine, 2 = fallback 1,
// 3 = fallback 2, absent = not part of the automatic fallback chain.
// Independent from EngineSettings above: `enabled` there separately gates
// whether an engine's voices show up in Studio's manual voice picker, so an
// engine can be enabled for manual assignment without being in the
// automatic chain, or vice versa.
//
// Replaces the old hardcoded chain (a single gemini31 boolean picked 2.5 vs
// 3.1; ElevenLabs/Chirp3-HD fallback order after that was fixed in code) —
// see synthesizeLine() in ttsService.ts for where this is actually applied.
// NOTE a real constraint this doesn't remove: the ElevenLabs fallback path
// only has a curated voice pool for Hebrew (HE_EL_VOICE_MAP) — setting it
// as a fallback here doesn't make it a general-purpose fallback for every
// language, only for Hebrew text, same as before.
export type EnginePriority = Partial<Record<TtsEngine, number>>;

// Matches current hardcoded production behavior exactly: Gemini 2.5
// primary, Chirp3-HD as fallback 1, ElevenLabs (Hebrew-only) as fallback 2.
export const DEFAULT_ENGINE_PRIORITY: EnginePriority = {
  gemini25: 1,
  chirp3hd: 2,
  elevenlabs: 3,
};
