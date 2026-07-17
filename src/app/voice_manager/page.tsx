"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { PRESET_VOICES } from "@/config/presetVoices";
import { HEBREW_VOICE_POOL } from "@/config/hebrewVoices";
import { TTS_ENGINES, DEFAULT_ENGINE_SETTINGS, DEFAULT_ENGINE_PRIORITY, type TtsEngine, type EngineSettings, type EnginePriority } from "@/config/ttsEngines";

const HEBREW_VOICE_IDS = new Set(HEBREW_VOICE_POOL.map((v) => v.id));

const ADMIN_EMAIL = "tomereden@gmail.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type Engine = "gemini" | "gemini31" | "elevenlabs" | "chirp3hd";
type Lang = "en" | "he";

const ENGINE_LABELS: Record<Engine, string> = {
  gemini: "Gemini 2.5 Flash TTS",
  gemini31: "Gemini 3.1 Flash TTS",
  elevenlabs: "ElevenLabs",
  chirp3hd: "Google Chirp3-HD",
};

interface ManagerVoice {
  id: string;
  name: string;
  description?: string;
  languages: Lang[];
  languageNote?: string;
}

interface ElParams {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
}

interface ChirpParams {
  speakingRate: number;
  pitch: number;
}

const EL_DEFAULTS: ElParams = { stability: 0.5, similarityBoost: 0.75, style: 0, useSpeakerBoost: true, speed: 1.0 };
const CHIRP_DEFAULTS: ChirpParams = { speakingRate: 1.0, pitch: 0 };

interface HistoryEntry {
  id: string;
  engine: Engine;
  voiceName: string;
  textSnippet: string;
  charCount: number;
  params?: Record<string, number | boolean>;
  timestamp: number;
  status: "ok" | "error";
  audioUrl?: string;
  error?: string;
}

function detectLanguage(text: string): Lang {
  return /[֐-׿]/.test(text) ? "he" : "en";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceManagerPage() {
  const { user, loading: authLoading } = useAuth();

  const [engine, setEngine] = useState<Engine>("elevenlabs");
  const [elVoices, setElVoices] = useState<ManagerVoice[]>([]);
  const [elVoicesError, setElVoicesError] = useState<string | null>(null);
  const [chirpVoices, setChirpVoices] = useState<ManagerVoice[]>([]);
  const [chirpVoicesError, setChirpVoicesError] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [text, setText] = useState("");
  const [elParams, setElParams] = useState<ElParams>(EL_DEFAULTS);
  const [chirpParams, setChirpParams] = useState<ChirpParams>(CHIRP_DEFAULTS);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const audioUrlsRef = useRef<string[]>([]);

  // ── Engine Settings (production-affecting — separate from the audition
  // engine toggle above) ──────────────────────────────────────────────────
  const [engineSettings, setEngineSettings] = useState<EngineSettings>(DEFAULT_ENGINE_SETTINGS);
  const [enginePriority, setEnginePriority] = useState<EnginePriority>(DEFAULT_ENGINE_PRIORITY);
  const [engineSettingsLoaded, setEngineSettingsLoaded] = useState(false);
  const [savingEngine, setSavingEngine] = useState<TtsEngine | null>(null);
  const [savingPriority, setSavingPriority] = useState(false);
  const [engineSettingsError, setEngineSettingsError] = useState<string | null>(null);
  const [regenText, setRegenText] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenResult, setRegenResult] = useState<{ totalCombos: number; succeeded: number; failed: number } | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tts-engine-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { settings: DEFAULT_ENGINE_SETTINGS, priority: DEFAULT_ENGINE_PRIORITY }))
      .then((data: { settings?: EngineSettings; priority?: EnginePriority }) => {
        setEngineSettings(data.settings ?? DEFAULT_ENGINE_SETTINGS);
        setEnginePriority(data.priority ?? DEFAULT_ENGINE_PRIORITY);
      })
      .catch(() => {
        setEngineSettings(DEFAULT_ENGINE_SETTINGS);
        setEnginePriority(DEFAULT_ENGINE_PRIORITY);
      })
      .finally(() => setEngineSettingsLoaded(true));
  }, []);

  const toggleEngine = async (id: TtsEngine, enabled: boolean) => {
    const prev = engineSettings;
    setEngineSettings((s) => ({ ...s, [id]: enabled }));
    setSavingEngine(id);
    setEngineSettingsError(null);
    try {
      const res = await fetch("/api/admin/tts-engine-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [id]: enabled } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed: ${res.status}`);
      }
    } catch (err) {
      setEngineSettings(prev); // revert on failure
      setEngineSettingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEngine(null);
    }
  };

  // rank 1 = default/primary engine, 2 = fallback 1, 3 = fallback 2. Each
  // rank can only be held by one engine and each engine can only hold one
  // rank, so assigning an engine to a rank clears BOTH whatever previously
  // held that rank AND whatever rank that engine previously held.
  const setEngineRank = async (rank: 1 | 2 | 3, engine: TtsEngine | "") => {
    const prev = enginePriority;
    const next: EnginePriority = { ...enginePriority };
    const payload: Partial<Record<string, number | null>> = {};

    const previousHolderOfRank = (Object.keys(next) as TtsEngine[]).find((k) => next[k] === rank);
    if (previousHolderOfRank && previousHolderOfRank !== engine) {
      delete next[previousHolderOfRank];
      payload[previousHolderOfRank] = null;
    }
    if (engine) {
      next[engine] = rank;
      payload[engine] = rank;
    }

    setEnginePriority(next);
    setSavingPriority(true);
    setEngineSettingsError(null);
    try {
      const res = await fetch("/api/admin/tts-engine-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed: ${res.status}`);
      }
    } catch (err) {
      setEnginePriority(prev); // revert on failure
      setEngineSettingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPriority(false);
    }
  };

  const enabledEngineIds = TTS_ENGINES.filter((e) => engineSettings[e.id]).map((e) => e.id);

  const handleRegeneratePreviews = async () => {
    if (!regenText.trim() || regenerating) return;
    setRegenerating(true);
    setRegenError(null);
    setRegenResult(null);
    try {
      const res = await fetch("/api/admin/generate-voice-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyAll: true, text: regenText, engines: enabledEngineIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
      setRegenResult({ totalCombos: data.totalCombos, succeeded: data.succeeded, failed: data.failed });
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  };

  const geminiVoices: ManagerVoice[] = useMemo(
    () => PRESET_VOICES.map((p) => ({ id: p.geminiVoiceName, name: p.name, description: p.desc, languages: ["en"] as Lang[] })),
    [],
  );

  const voices = engine === "elevenlabs" ? elVoices : engine === "chirp3hd" ? chirpVoices : geminiVoices;
  const selectedVoice = voices.find((v) => v.id === selectedVoiceId);
  const detectedLang = detectLanguage(text);
  const mismatch = !!selectedVoice && text.trim().length > 0 && !selectedVoice.languages.includes(detectedLang);

  // Fetch EL voices once (personal library — stock + cloned family voices)
  useEffect(() => {
    if (engine !== "elevenlabs" || elVoices.length > 0 || loadingVoices) return;
    setLoadingVoices(true);
    setElVoicesError(null);
    fetch("/api/el-voices?mode=personal", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data: { voices: { id: string; name: string; category: string; verifiedLanguages: { language: string }[] }[] }) => {
        // ElevenLabs' verified_languages never actually includes "he" for any
        // voice in this account (confirmed by direct API check) — production
        // always forces eleven_v3 + language_code="he" against a small,
        // hand-tested pool (HEBREW_VOICE_POOL) regardless of what EL's own
        // language metadata claims. So verified_languages alone would wrongly
        // show every one of those proven voices as English-only.
        const mapped: ManagerVoice[] = (data.voices ?? []).map((v) => {
          const langs = new Set(v.verifiedLanguages.map((vl) => vl.language));
          const hasEn = langs.has("en") || v.verifiedLanguages.length === 0;
          const hasHeVerified = langs.has("he");
          const isCurated = HEBREW_VOICE_IDS.has(v.id);

          if (isCurated) {
            return { id: v.id, name: v.name, description: v.category, languages: ["en", "he"], languageNote: "hand-verified for Hebrew — used in production casting" };
          }
          if (v.verifiedLanguages.length === 0) {
            // No verified_languages usually means an Instant Voice Clone — these
            // aren't pre-verified per-language, but the multilingual model (eleven_v3)
            // handles any language. Assume multilingual rather than "no languages".
            return { id: v.id, name: v.name, description: v.category, languages: ["en", "he"], languageNote: "cloned — multilingual assumed" };
          }
          const languages: Lang[] = [...(hasEn ? (["en"] as const) : []), ...(hasHeVerified ? (["he"] as const) : [])];
          return {
            id: v.id, name: v.name, description: v.category, languages,
            languageNote: "Hebrew not verified by ElevenLabs — eleven_v3 may still work, untested",
          };
        });
        setElVoices(mapped);
      })
      .catch((e) => setElVoicesError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingVoices(false));
  }, [engine, elVoices.length, loadingVoices]);

  // Fetch Chirp3-HD voices once (live from Google's real catalog, grouped by
  // base name across en-US/he-IL — see /api/voice-manager/chirp-voices)
  useEffect(() => {
    if (engine !== "chirp3hd" || chirpVoices.length > 0 || loadingVoices) return;
    setLoadingVoices(true);
    setChirpVoicesError(null);
    fetch("/api/voice-manager/chirp-voices", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data: { voices: { id: string; name: string; languages: Lang[] }[] }) => {
        setChirpVoices(data.voices ?? []);
      })
      .catch((e) => setChirpVoicesError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingVoices(false));
  }, [engine, chirpVoices.length, loadingVoices]);

  // Reset selection when switching engines
  useEffect(() => {
    setSelectedVoiceId("");
  }, [engine]);

  useEffect(() => () => { audioUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const activeParams: Record<string, number | boolean> | undefined =
    engine === "elevenlabs" ? { ...elParams } : engine === "chirp3hd" ? { ...chirpParams } : undefined;

  const handleGenerate = async () => {
    if (!selectedVoice || !text.trim() || generating) return;
    setGenerating(true);
    const id = `${Date.now()}`;
    try {
      const res = await fetch("/api/voice-manager/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine,
          voiceId: selectedVoice.id,
          text,
          language: detectedLang,
          ...(activeParams ? { params: activeParams } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      audioUrlsRef.current.push(audioUrl);
      const entry: HistoryEntry = {
        id, engine, voiceName: selectedVoice.name, textSnippet: text.slice(0, 60),
        charCount: text.length, params: activeParams,
        timestamp: Date.now(), status: "ok", audioUrl,
      };
      setHistory((h) => [entry, ...h].slice(0, 10));
    } catch (err) {
      const entry: HistoryEntry = {
        id, engine, voiceName: selectedVoice.name, textSnippet: text.slice(0, 60),
        charCount: text.length, params: activeParams,
        timestamp: Date.now(), status: "error", error: err instanceof Error ? err.message : String(err),
      };
      setHistory((h) => [entry, ...h].slice(0, 10));
    } finally {
      setGenerating(false);
    }
  };

  // ── Auth gate — identical mechanism to /admin ──────────────────────────────
  if (authLoading) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Loading…</div>;
  }
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#666" }}>
        <span style={{ fontSize: 40 }}>🔐</span>
        <p>Admin access only</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#ddd", fontFamily: "monospace", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Voice Manager</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Internal TTS audition tool — Gemini 2.5, Gemini 3.1, ElevenLabs &amp; Google Chirp3-HD. Not user-facing.</p>

      {/* ── Engine Settings — production-affecting ─────────────────────── */}
      <div style={{ border: "1px solid #2a2a3a", borderRadius: 8, padding: 16, marginBottom: 24, background: "#0d0d14" }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Engine Settings</p>
        <p style={{ color: "#666", fontSize: 12, marginBottom: 12 }}>
          Unchecking an engine removes its voices from new character assignments in Studio going forward
          (existing assignments keep working) — independent from the synthesis order below, which controls
          which engine actually produces the audio for a real story.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          {TTS_ENGINES.map((e) => (
            <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: engineSettingsLoaded ? "pointer" : "default", opacity: engineSettingsLoaded ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={engineSettings[e.id]}
                disabled={!engineSettingsLoaded || savingEngine === e.id}
                onChange={(ev) => toggleEngine(e.id, ev.target.checked)}
              />
              {e.label}
              {savingEngine === e.id && <span style={{ color: "#666", fontSize: 11 }}>saving…</span>}
            </label>
          ))}
        </div>
        {engineSettingsError && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{engineSettingsError}</p>}

        <div style={{ borderTop: "1px solid #222", marginTop: 12, paddingTop: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Synthesis Priority</p>
          <p style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
            Which engine actually produces real story audio, and in what order the next two are tried if it
            fails. If both Gemini models are set (any two ranks), the second is tried on a failure before
            falling through to ElevenLabs/Chirp3-HD, since that keeps the same voice identity instead of
            swapping providers. ElevenLabs only has a curated fallback voice pool for Hebrew — setting it
            here doesn&apos;t make it a fallback for every language, only for Hebrew text.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {([1, 2, 3] as const).map((rank) => {
              const currentEngine = (Object.keys(enginePriority) as TtsEngine[]).find((e) => enginePriority[e] === rank) ?? "";
              return (
                <label key={rank} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999" }}>
                  {rank === 1 ? "Default engine" : `Fallback ${rank - 1}`}
                  <select
                    value={currentEngine}
                    disabled={!engineSettingsLoaded || savingPriority}
                    onChange={(ev) => setEngineRank(rank, ev.target.value as TtsEngine | "")}
                    style={{ background: "#12121a", border: "1px solid #333", borderRadius: 6, padding: "6px 8px", color: "#ddd", fontFamily: "monospace", fontSize: 13, minWidth: 180 }}
                  >
                    <option value="">— none —</option>
                    {TTS_ENGINES.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </label>
              );
            })}
            {savingPriority && <span style={{ color: "#666", fontSize: 11, alignSelf: "flex-end", marginBottom: 8 }}>saving…</span>}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #222", marginTop: 12, paddingTop: 12 }}>
          <p style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>
            Regenerate Previews — generates a sample for every voice under the checked engines above, using
            the sentence below, in every supported language. Replaces existing preview samples.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={regenText}
              onChange={(e) => setRegenText(e.target.value)}
              placeholder="Sentence to use for every preview…"
              style={{ flex: 1, background: "#12121a", border: "1px solid #333", borderRadius: 6, padding: "8px 10px", color: "#ddd", fontFamily: "monospace", fontSize: 13 }}
            />
            <button
              onClick={handleRegeneratePreviews}
              disabled={!regenText.trim() || regenerating || enabledEngineIds.length === 0}
              style={{
                padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: !regenText.trim() || regenerating || enabledEngineIds.length === 0 ? "#222" : "#7c3aed",
                color: !regenText.trim() || regenerating || enabledEngineIds.length === 0 ? "#555" : "#fff",
                border: "none", cursor: !regenText.trim() || regenerating ? "not-allowed" : "pointer",
              }}
            >
              {regenerating ? "Regenerating…" : "Regenerate Previews"}
            </button>
          </div>
          {enabledEngineIds.length === 0 && engineSettingsLoaded && (
            <p style={{ color: "#fbbf24", fontSize: 12, marginTop: 6 }}>No engines checked — nothing to regenerate.</p>
          )}
          {regenError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{regenError}</p>}
          {regenResult && (
            <p style={{ color: "#4ade80", fontSize: 12, marginTop: 6 }}>
              Done — {regenResult.succeeded}/{regenResult.totalCombos} samples generated{regenResult.failed > 0 ? `, ${regenResult.failed} failed` : ""}.
            </p>
          )}
        </div>
      </div>

      {/* Engine toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["gemini", "gemini31", "elevenlabs", "chirp3hd"] as Engine[]).map((e) => (
          <button
            key={e}
            onClick={() => setEngine(e)}
            style={{
              padding: "8px 16px", borderRadius: 6, cursor: "pointer",
              background: engine === e ? "#2563eb" : "#1a1a24",
              border: `1px solid ${engine === e ? "#3b82f6" : "#333"}`,
              color: engine === e ? "#fff" : "#999", fontSize: 13,
            }}
          >
            {ENGINE_LABELS[e]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        {/* Voice list */}
        <div style={{ border: "1px solid #222", borderRadius: 8, padding: 12, maxHeight: 500, overflowY: "auto" }}>
          <p style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 8 }}>
            Voices {loadingVoices ? "(loading…)" : `(${voices.length})`}
          </p>
          {elVoicesError && engine === "elevenlabs" && (
            <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{elVoicesError}</p>
          )}
          {chirpVoicesError && engine === "chirp3hd" && (
            <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{chirpVoicesError}</p>
          )}
          {voices.map((v) => (
            <label key={v.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 4px", cursor: "pointer", borderRadius: 4, background: selectedVoiceId === v.id ? "#1a1a24" : "transparent" }}>
              <input type="radio" name="voice" checked={selectedVoiceId === v.id} onChange={() => setSelectedVoiceId(v.id)} style={{ marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{v.name}</span>
                  {v.languages.map((l) => (
                    <span key={l} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: l === "he" ? "#4c1d95" : "#1e3a5f", color: l === "he" ? "#c4b5fd" : "#7dd3fc" }}>
                      {l.toUpperCase()}
                    </span>
                  ))}
                </div>
                {v.description && <p style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{v.description}{v.languageNote ? ` (${v.languageNote})` : ""}</p>}
              </div>
            </label>
          ))}
        </div>

        {/* Text + params + generate */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type text to synthesize…"
            rows={4}
            style={{ width: "100%", background: "#12121a", border: "1px solid #333", borderRadius: 6, padding: 10, color: "#ddd", fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12 }}>
            <span style={{ color: "#666" }}>Detected: {detectedLang === "he" ? "Hebrew" : "English"}</span>
            {mismatch && (
              <span style={{ color: "#fbbf24" }}>
                ⚠ Selected voice may not support {detectedLang === "he" ? "Hebrew" : "English"}
              </span>
            )}
          </div>

          {engine === "elevenlabs" && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["stability", 0, 1, 0.01],
                ["similarityBoost", 0, 1, 0.01],
                ["style", 0, 1, 0.01],
                ["speed", 0.7, 1.2, 0.01],
              ] as [keyof ElParams, number, number, number][]).map(([key, min, max, step]) => (
                <label key={key} style={{ fontSize: 12, color: "#999" }}>
                  {key} — {(elParams[key] as number).toFixed(2)}
                  <input
                    type="range" min={min} max={max} step={step}
                    value={elParams[key] as number}
                    onChange={(e) => setElParams((p) => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    style={{ width: "100%" }}
                  />
                </label>
              ))}
              <label style={{ fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={elParams.useSpeakerBoost} onChange={(e) => setElParams((p) => ({ ...p, useSpeakerBoost: e.target.checked }))} />
                use_speaker_boost
              </label>
            </div>
          )}

          {(engine === "gemini" || engine === "gemini31") && (
            <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
              {ENGINE_LABELS[engine]} exposes no synthesis parameters beyond voice selection — no pitch/speed/style controls exist in this API.
            </p>
          )}

          {engine === "chirp3hd" && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, color: "#999" }}>
                speakingRate — {chirpParams.speakingRate.toFixed(2)}
                <input
                  type="range" min={0.25} max={4.0} step={0.05}
                  value={chirpParams.speakingRate}
                  onChange={(e) => setChirpParams((p) => ({ ...p, speakingRate: parseFloat(e.target.value) }))}
                  style={{ width: "100%" }}
                />
              </label>
              <label style={{ fontSize: 12, color: "#999" }}>
                pitch — {chirpParams.pitch.toFixed(1)}
                <input
                  type="range" min={-20} max={20} step={0.5}
                  value={chirpParams.pitch}
                  onChange={(e) => setChirpParams((p) => ({ ...p, pitch: parseFloat(e.target.value) }))}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!selectedVoice || !text.trim() || generating}
            style={{
              marginTop: 16, padding: "10px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700,
              background: !selectedVoice || !text.trim() || generating ? "#222" : "#2563eb",
              color: !selectedVoice || !text.trim() || generating ? "#555" : "#fff",
              border: "none", cursor: !selectedVoice || !text.trim() || generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? "Generating…" : "Generate"}
          </button>

          {/* History */}
          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 8 }}>History (this session)</p>
            {history.length === 0 && <p style={{ fontSize: 12, color: "#444" }}>No generations yet.</p>}
            {history.map((h) => (
              <div key={h.id} style={{ border: "1px solid #222", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                  <strong>{ENGINE_LABELS[h.engine]}</strong> · {h.voiceName} · {h.charCount} chars
                  {h.params && ` · ${Object.entries(h.params).map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(2) : v}`).join(" ")}`}
                </div>
                <div style={{ fontSize: 12, color: "#777", marginBottom: 6, fontStyle: "italic" }}>&ldquo;{h.textSnippet}{h.textSnippet.length >= 60 ? "…" : ""}&rdquo;</div>
                {h.status === "ok" ? (
                  <audio controls src={h.audioUrl} style={{ width: "100%", height: 32 }} />
                ) : (
                  <p style={{ color: "#f87171", fontSize: 12, whiteSpace: "pre-wrap" }}>{h.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
