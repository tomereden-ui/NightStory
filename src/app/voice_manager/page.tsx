"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { PRESET_VOICES } from "@/config/presetVoices";
import { HEBREW_VOICE_POOL } from "@/config/hebrewVoices";

const HEBREW_VOICE_IDS = new Set(HEBREW_VOICE_POOL.map((v) => v.id));

const ADMIN_EMAIL = "tomereden@gmail.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type Engine = "elevenlabs" | "gemini";
type Lang = "en" | "he";

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

const EL_DEFAULTS: ElParams = { stability: 0.5, similarityBoost: 0.75, style: 0, useSpeakerBoost: true, speed: 1.0 };

interface HistoryEntry {
  id: string;
  engine: Engine;
  voiceName: string;
  textSnippet: string;
  charCount: number;
  params?: ElParams;
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
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [text, setText] = useState("");
  const [params, setParams] = useState<ElParams>(EL_DEFAULTS);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const audioUrlsRef = useRef<string[]>([]);

  const geminiVoices: ManagerVoice[] = useMemo(
    () => PRESET_VOICES.map((p) => ({ id: p.geminiVoiceName, name: p.name, description: p.desc, languages: ["en"] as Lang[] })),
    [],
  );

  const voices = engine === "elevenlabs" ? elVoices : geminiVoices;
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

  // Reset selection when switching engines
  useEffect(() => {
    setSelectedVoiceId("");
  }, [engine]);

  useEffect(() => () => { audioUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

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
          ...(engine === "elevenlabs" ? { params } : {}),
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
        charCount: text.length, params: engine === "elevenlabs" ? params : undefined,
        timestamp: Date.now(), status: "ok", audioUrl,
      };
      setHistory((h) => [entry, ...h].slice(0, 10));
    } catch (err) {
      const entry: HistoryEntry = {
        id, engine, voiceName: selectedVoice.name, textSnippet: text.slice(0, 60),
        charCount: text.length, params: engine === "elevenlabs" ? params : undefined,
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
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Internal TTS audition tool — ElevenLabs &amp; Gemini 2.5 Flash TTS. Not user-facing.</p>

      {/* Engine toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["elevenlabs", "gemini"] as Engine[]).map((e) => (
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
            {e === "elevenlabs" ? "ElevenLabs" : "Gemini 2.5 Flash TTS"}
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

          {engine === "elevenlabs" ? (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["stability", 0, 1, 0.01],
                ["similarityBoost", 0, 1, 0.01],
                ["style", 0, 1, 0.01],
                ["speed", 0.7, 1.2, 0.01],
              ] as [keyof ElParams, number, number, number][]).map(([key, min, max, step]) => (
                <label key={key} style={{ fontSize: 12, color: "#999" }}>
                  {key} — {(params[key] as number).toFixed(2)}
                  <input
                    type="range" min={min} max={max} step={step}
                    value={params[key] as number}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    style={{ width: "100%" }}
                  />
                </label>
              ))}
              <label style={{ fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={params.useSpeakerBoost} onChange={(e) => setParams((p) => ({ ...p, useSpeakerBoost: e.target.checked }))} />
                use_speaker_boost
              </label>
            </div>
          ) : (
            <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
              Gemini 2.5 Flash TTS exposes no synthesis parameters beyond voice selection — no pitch/speed/style controls exist in this API.
            </p>
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
                  <strong>{h.engine === "elevenlabs" ? "ElevenLabs" : "Gemini"}</strong> · {h.voiceName} · {h.charCount} chars
                  {h.params && ` · stability=${h.params.stability.toFixed(2)} sim=${h.params.similarityBoost.toFixed(2)} style=${h.params.style.toFixed(2)} speed=${h.params.speed.toFixed(2)} boost=${h.params.useSpeakerBoost}`}
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
