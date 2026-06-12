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

// ─── Web Audio merge ──────────────────────────────────────────────────────────

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const length      = buffer.length;
  const pcmLength   = length * numChannels * 2;
  const ab          = new ArrayBuffer(44 + pcmLength);
  const view        = new DataView(ab);

  const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); view.setUint32(4, 36 + pcmLength, true); ws(8, "WAVE");
  ws(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); ws(36, "data"); view.setUint32(40, pcmLength, true);

  let off = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

interface MergeOptions {
  speechOffsetSec: number;
  sfxOffsetSec: number;
  sfxVolume: number;   // 0–1
  sfxLoop: boolean;
}

async function mergeAudioInBrowser(
  speechUrl: string,
  sfxUrl: string,
  opts: MergeOptions,
): Promise<string> {
  const ctx = new AudioContext();

  const [sr, sfr] = await Promise.all([fetch(speechUrl), fetch(sfxUrl)]);
  const [sRaw, sfRaw] = await Promise.all([sr.arrayBuffer(), sfr.arrayBuffer()]);
  const [speechBuf, sfxBuf] = await Promise.all([
    ctx.decodeAudioData(sRaw),
    ctx.decodeAudioData(sfRaw),
  ]);

  const sampleRate   = speechBuf.sampleRate;
  const speechOffset = Math.round(opts.speechOffsetSec * sampleRate);
  const sfxOffset    = Math.round(opts.sfxOffsetSec    * sampleRate);

  // Total length = end of whichever track finishes last
  const speechEnd = speechOffset + speechBuf.length;
  const sfxEnd    = opts.sfxLoop
    ? speechEnd                           // SFX runs until speech ends
    : sfxOffset + sfxBuf.length;
  const outLength = Math.max(speechEnd, sfxEnd);

  const numCh = Math.max(speechBuf.numberOfChannels, sfxBuf.numberOfChannels);
  const out   = ctx.createBuffer(numCh, outLength, sampleRate);

  for (let ch = 0; ch < numCh; ch++) {
    const outData    = out.getChannelData(ch);
    const speechData = speechBuf.getChannelData(Math.min(ch, speechBuf.numberOfChannels - 1));
    const sfxData    = sfxBuf.getChannelData(Math.min(ch, sfxBuf.numberOfChannels - 1));

    // Speech
    for (let i = 0; i < speechBuf.length; i++) {
      outData[speechOffset + i] += speechData[i];
    }

    // SFX
    const sfxSamples = opts.sfxLoop ? (speechEnd - sfxOffset) : sfxBuf.length;
    for (let i = 0; i < sfxSamples; i++) {
      const idx = sfxOffset + i;
      if (idx >= 0 && idx < outLength) {
        outData[idx] += sfxData[i % sfxBuf.length] * opts.sfxVolume;
      }
    }

    // Soft clip
    for (let i = 0; i < outLength; i++) {
      if (outData[i] >  1) outData[i] =  1;
      if (outData[i] < -1) outData[i] = -1;
    }
  }

  await ctx.close();
  return URL.createObjectURL(audioBufferToWavBlob(out));
}

// ─── Timing control row ───────────────────────────────────────────────────────

function TimingRow({
  label,
  color,
  value,
  max,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold w-16 flex-shrink-0" style={{ color }}>
        {label}
      </span>
      <input
        type="range" min={0} max={max} step={0.1} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="flex-1 cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className="text-white/40 text-[11px] w-10 text-right flex-shrink-0 tabular-nums">
        {value.toFixed(1)}s
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [mode, setMode] = useState<Mode>("tts");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsText, setTtsText]         = useState("");
  const [sfxAudioUrl, setSfxAudioUrl] = useState<string | null>(null);
  const [sfxText, setSfxText]         = useState("");

  // Merge timing state
  const [speechOffset, setSpeechOffset] = useState(0);
  const [sfxOffset,    setSfxOffset]    = useState(0);
  const [sfxVolume,    setSfxVolume]    = useState(28);   // percent
  const [sfxLoop,      setSfxLoop]      = useState(true);

  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
  const [merging,   setMerging]   = useState(false);
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

      if (mode === "tts") { setTtsAudioUrl(data.audioUrl); setTtsText(text.trim()); }
      else                { setSfxAudioUrl(data.audioUrl); setSfxText(text.trim()); }
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
      const url = await mergeAudioInBrowser(ttsAudioUrl, sfxAudioUrl, {
        speechOffsetSec: speechOffset,
        sfxOffsetSec:    sfxOffset,
        sfxVolume:       sfxVolume / 100,
        sfxLoop,
      });
      setMergedAudioUrl(url);
    } catch (err: unknown) {
      setMergeError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }, [ttsAudioUrl, sfxAudioUrl, speechOffset, sfxOffset, sfxVolume, sfxLoop]);

  const canGenerate = text.trim().length > 0 && !loading;
  const canMerge    = !!ttsAudioUrl && !!sfxAudioUrl && !merging;

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      <div className="px-5 pt-12 pb-36">

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
                background: "rgba(79,195,247,0.12)", color: "#4fc3f7",
                border: "1px solid rgba(79,195,247,0.25)",
              } : { color: "rgba(255,255,255,0.3)" }}
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
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>

        {mode === "sfx" && (
          <p className="text-white/20 text-[10px] mb-4">
            Requires <span style={{ color: "rgba(79,195,247,0.5)" }}>ELEVENLABS_API_KEY</span> in .env.local
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] mt-2"
          style={canGenerate ? {
            background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F",
            boxShadow: "0 4px 24px rgba(79,195,247,0.3)",
          } : {
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">{mode === "tts" ? "🎙️" : "🔊"}</span>
              {mode === "tts" ? "Synthesising…" : "Generating SFX…"}
            </span>
          ) : mode === "tts" ? "SYNTHESISE VOICE" : "GENERATE SOUND FX"}
        </button>

        {error && (
          <div className="mt-5 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {error}
          </div>
        )}

        {/* Individual players */}
        <div className="flex flex-col gap-3 mt-5">
          {ttsAudioUrl && (
            <AudioPlayer audioUrl={ttsAudioUrl} label="Voice preview"
              sublabel={ttsText.slice(0, 60) + (ttsText.length > 60 ? "…" : "")} />
          )}
          {sfxAudioUrl && (
            <AudioPlayer audioUrl={sfxAudioUrl} label="SFX preview"
              sublabel={sfxText.slice(0, 60) + (sfxText.length > 60 ? "…" : "")} />
          )}
        </div>

        {/* ── Merge section ── */}
        {(ttsAudioUrl || sfxAudioUrl) && (
          <div className="mt-5">
            {/* Status chips */}
            <div className="flex gap-2 mb-4">
              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={ttsAudioUrl ? {
                  background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.3)", color: "#4fc3f7",
                } : {
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.25)",
                }}>
                🎙️ Speech {ttsAudioUrl ? "✓" : "—"}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={sfxAudioUrl ? {
                  background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa",
                } : {
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.25)",
                }}>
                🔊 SFX {sfxAudioUrl ? "✓" : "—"}
              </span>
            </div>

            {/* Timing controls — only meaningful when both exist */}
            {ttsAudioUrl && sfxAudioUrl && (
              <div
                className="rounded-2xl px-4 py-4 mb-4 flex flex-col gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
                  Mix Timing
                </p>

                <TimingRow
                  label="🎙️ Speech"
                  color="#4fc3f7"
                  value={speechOffset}
                  max={10}
                  onChange={(v) => { setSpeechOffset(v); setMergedAudioUrl(null); }}
                />
                <TimingRow
                  label="🔊 SFX"
                  color="#a78bfa"
                  value={sfxOffset}
                  max={10}
                  onChange={(v) => { setSfxOffset(v); setMergedAudioUrl(null); }}
                />

                {/* Volume */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold w-16 flex-shrink-0" style={{ color: "#a78bfa" }}>
                    SFX Vol
                  </span>
                  <input
                    type="range" min={0} max={100} step={1} value={sfxVolume}
                    onChange={(e) => { setSfxVolume(+e.target.value); setMergedAudioUrl(null); }}
                    className="flex-1 cursor-pointer"
                    style={{ accentColor: "#a78bfa" }}
                  />
                  <span className="text-white/40 text-[11px] w-10 text-right flex-shrink-0 tabular-nums">
                    {sfxVolume}%
                  </span>
                </div>

                {/* Loop toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold" style={{ color: "#a78bfa" }}>
                    Loop SFX for speech duration
                  </span>
                  <button
                    onClick={() => { setSfxLoop((v) => !v); setMergedAudioUrl(null); }}
                    className="w-10 h-6 rounded-full transition-all flex-shrink-0 relative"
                    style={{
                      background: sfxLoop ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)",
                      border: sfxLoop ? "1px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{
                        left: sfxLoop ? "calc(100% - 22px)" : "2px",
                        background: sfxLoop ? "#a78bfa" : "rgba(255,255,255,0.3)",
                      }}
                    />
                  </button>
                </div>

                {/* Visual timeline */}
                <div>
                  <p className="text-white/20 text-[9px] uppercase tracking-widest mb-1.5">Preview timeline</p>
                  <div className="relative h-7 rounded-lg overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    {/* Speech bar */}
                    <div
                      className="absolute top-1 h-2.5 rounded-sm opacity-70"
                      style={{
                        left: `${(speechOffset / 12) * 100}%`,
                        width: "40%",
                        background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
                        maxWidth: `${100 - (speechOffset / 12) * 100}%`,
                      }}
                    />
                    {/* SFX bar */}
                    <div
                      className="absolute bottom-1 h-2.5 rounded-sm opacity-60"
                      style={{
                        left: `${(sfxOffset / 12) * 100}%`,
                        width: sfxLoop ? `${100 - (sfxOffset / 12) * 100}%` : "30%",
                        background: "linear-gradient(90deg,#8B5CF6,#a78bfa)",
                        maxWidth: `${100 - (sfxOffset / 12) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-white/15 text-[9px] mt-0.5">
                    <span>0s</span><span>6s</span><span>12s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Merge button */}
            <button
              onClick={handleMerge}
              disabled={!canMerge}
              className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={canMerge ? {
                background: "linear-gradient(90deg,#8B5CF6,#4fc3f7)", color: "#05080F",
                boxShadow: "0 4px 24px rgba(139,92,246,0.35)",
              } : {
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {merging ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">🎚️</span>Merging in browser…
                </span>
              ) : !ttsAudioUrl || !sfxAudioUrl ? (
                `Merge  ·  need ${!ttsAudioUrl ? "speech" : "SFX"} first`
              ) : "🎚️  MERGE SPEECH + SFX"}
            </button>

            {mergeError && (
              <div className="mt-3 px-4 py-3 rounded-2xl text-xs leading-relaxed"
                style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
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
                  sublabel={`Speech +${speechOffset}s · SFX +${sfxOffset}s · vol ${sfxVolume}%${sfxLoop ? " · looped" : ""}`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
