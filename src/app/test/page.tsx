"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "tts" | "sfx";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function TestPage() {
  const [mode, setMode] = useState<Mode>("tts");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    try {
      const res = await fetch("/api/test-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setAudioUrl(data.audioUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [mode, text]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }, [playing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  };

  const canGenerate = text.trim().length > 0 && !loading;

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
              onClick={() => { setMode(m); setAudioUrl(null); setError(null); }}
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
      </div>

      {/* Audio player — shown once audio is ready */}
      {audioUrl && (
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
            className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-6"
            style={{ background: "linear-gradient(to top, #05080F 75%, transparent)" }}
          >
            <div
              className="rounded-2xl px-5 py-4"
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
                  <p className="text-white text-sm font-semibold">
                    {mode === "tts" ? "Voice preview" : "SFX preview"}
                  </p>
                  <p className="text-white/30 text-xs truncate">{text.slice(0, 50)}{text.length > 50 ? "…" : ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-white/30 text-[10px] w-8 text-right flex-shrink-0">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 cursor-pointer"
                  style={{ accentColor: "#4fc3f7" }}
                />
                <span className="text-white/30 text-[10px] w-8 flex-shrink-0">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
