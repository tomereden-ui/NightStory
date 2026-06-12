"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "tts" | "sfx";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function AudioPlayer({
  audioUrl,
  label,
  sublabel,
}: {
  audioUrl: string;
  label: string;
  sublabel?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />
      <div
        className="rounded-2xl px-4 py-3.5"
        style={{
          background: "rgba(15,18,28,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handlePlayPause}
            className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#4fc3f7,#2a8cb5)" }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">{label}</p>
            {sublabel && <p className="text-white/30 text-xs truncate">{sublabel}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-[10px] w-8 text-right flex-shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
            onChange={handleSeek}
            className="flex-1 cursor-pointer"
            style={{ accentColor: "#4fc3f7" }}
          />
          <span className="text-white/30 text-[10px] w-8 flex-shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </>
  );
}

export default function TestPage() {
  const [mode, setMode] = useState<Mode>("tts");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track TTS and SFX audio separately
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsText, setTtsText] = useState("");
  const [sfxAudioUrl, setSfxAudioUrl] = useState<string | null>(null);
  const [sfxText, setSfxText] = useState("");

  // Merged audio
  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setMergedAudioUrl(null);
    setMergeError(null);

    try {
      const res = await fetch("/api/test-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      if (mode === "tts") {
        setTtsAudioUrl(data.audioUrl);
        setTtsText(text.trim());
      } else {
        setSfxAudioUrl(data.audioUrl);
        setSfxText(text.trim());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [mode, text]);

  const handleMerge = useCallback(async () => {
    if (!ttsAudioUrl || !sfxAudioUrl) return;
    setMerging(true);
    setMergeError(null);
    setMergedAudioUrl(null);

    try {
      const res = await fetch("/api/merge-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speechUrl: ttsAudioUrl, sfxUrl: sfxAudioUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");
      setMergedAudioUrl(data.audioUrl);
    } catch (err: unknown) {
      setMergeError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }, [ttsAudioUrl, sfxAudioUrl]);

  const canGenerate = text.trim().length > 0 && !loading;
  const canMerge = !!ttsAudioUrl && !!sfxAudioUrl && !merging;

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      <div className="px-5 pt-12 pb-36">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-base font-semibold text-white tracking-wide">Audio Test Lab</h1>
        </div>

        {/* Mode toggle */}
        <div
          className="flex mb-6 rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {(["tts", "sfx"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
              style={mode === m ? {
                background: "rgba(79,195,247,0.12)",
                color: "#4fc3f7",
                border: "1px solid rgba(79,195,247,0.25)",
              } : {
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {m === "tts" ? "🎙️ Voice (TTS)" : "🔊 Sound FX"}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="mb-2">
          <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
            {mode === "tts" ? "Text to speak" : "Sound effect description"}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={mode === "tts" ? 5 : 3}
            placeholder={mode === "tts"
              ? "Type any text and hear it spoken aloud…"
              : "Describe a sound effect, e.g. \"thunderstorm with heavy rain and distant thunder\""}
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>

        {mode === "sfx" && (
          <p className="text-white/20 text-[10px] mb-4">
            Requires <span style={{ color: "rgba(79,195,247,0.5)" }}>ELEVENLABS_API_KEY</span> in .env.local
          </p>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] mt-2"
          style={canGenerate ? {
            background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
            color: "#05080F",
            boxShadow: "0 4px 24px rgba(79,195,247,0.3)",
          } : {
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">{mode === "tts" ? "🎙️" : "🔊"}</span>
              {mode === "tts" ? "Synthesising…" : "Generating SFX…"}
            </span>
          ) : (
            mode === "tts" ? "SYNTHESISE VOICE" : "GENERATE SOUND FX"
          )}
        </button>

        {/* Error */}
        {error && (
          <div
            className="mt-5 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{
              background: "rgba(236,72,153,0.1)",
              border: "1px solid rgba(236,72,153,0.25)",
              color: "#EC4899",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Generated audio players */}
        <div className="flex flex-col gap-3 mt-5">
          {ttsAudioUrl && (
            <AudioPlayer
              audioUrl={ttsAudioUrl}
              label="Voice preview"
              sublabel={ttsText.slice(0, 60) + (ttsText.length > 60 ? "…" : "")}
            />
          )}
          {sfxAudioUrl && (
            <AudioPlayer
              audioUrl={sfxAudioUrl}
              label="SFX preview"
              sublabel={sfxText.slice(0, 60) + (sfxText.length > 60 ? "…" : "")}
            />
          )}
        </div>

        {/* Merge section */}
        {(ttsAudioUrl || sfxAudioUrl) && (
          <div className="mt-5">
            {/* Status chips */}
            <div className="flex gap-2 mb-3">
              <span
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={ttsAudioUrl ? {
                  background: "rgba(79,195,247,0.12)",
                  border: "1px solid rgba(79,195,247,0.3)",
                  color: "#4fc3f7",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                🎙️ Speech {ttsAudioUrl ? "✓" : "—"}
              </span>
              <span
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={sfxAudioUrl ? {
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "#a78bfa",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                🔊 SFX {sfxAudioUrl ? "✓" : "—"}
              </span>
            </div>

            {/* Merge button */}
            <button
              onClick={handleMerge}
              disabled={!canMerge}
              className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={canMerge ? {
                background: "linear-gradient(90deg,#8B5CF6,#4fc3f7)",
                color: "#05080F",
                boxShadow: "0 4px 24px rgba(139,92,246,0.35)",
              } : {
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {merging ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">🎚️</span>
                  Merging audio…
                </span>
              ) : !ttsAudioUrl || !sfxAudioUrl ? (
                `Merge  ·  need ${!ttsAudioUrl ? "speech" : "SFX"} first`
              ) : (
                "🎚️  MERGE SPEECH + SFX"
              )}
            </button>

            {mergeError && (
              <div
                className="mt-3 px-4 py-3 rounded-2xl text-xs leading-relaxed"
                style={{
                  background: "rgba(236,72,153,0.1)",
                  border: "1px solid rgba(236,72,153,0.25)",
                  color: "#EC4899",
                }}
              >
                ⚠ {mergeError}
              </div>
            )}

            {mergedAudioUrl && (
              <div className="mt-3">
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">
                  Merged Result
                </p>
                <AudioPlayer
                  audioUrl={mergedAudioUrl}
                  label="Speech + SFX mix"
                  sublabel="Voice over ambient sound"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
