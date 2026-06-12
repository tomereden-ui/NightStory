"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "tts" | "sfx";

interface AudioClip {
  id: string;
  url: string;
  text: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Inline clip player ───────────────────────────────────────────────────────

function ClipPlayer({
  clip,
  accent,
  selected,
  onSelect,
  onDelete,
}: {
  clip: AudioClip;
  accent: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handlePlayPause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play();
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (a) a.currentTime = +e.target.value;
  };

  return (
    <div
      className="rounded-2xl px-3 py-3 transition-all"
      style={{
        background: selected ? `${accent}0f` : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? accent + "55" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <audio
        ref={audioRef}
        src={clip.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* Top row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Play */}
        <button
          onClick={handlePlayPause}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 active:scale-95 transition-transform"
          style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}
        >
          <span style={{ color: accent }}>{playing ? "⏸" : "▶"}</span>
        </button>

        {/* Text preview */}
        <p className="flex-1 text-white/55 text-xs truncate min-w-0">{clip.text}</p>

        {/* Select for merge */}
        <button
          onClick={onSelect}
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg flex-shrink-0 transition-all"
          style={selected ? {
            background: `${accent}22`, color: accent, border: `1px solid ${accent}55`,
          } : {
            background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {selected ? "✓ selected" : "use"}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors flex-shrink-0 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Seek bar */}
      <div className="flex items-center gap-2">
        <span className="text-white/25 text-[9px] w-7 text-right flex-shrink-0 tabular-nums">
          {formatTime(currentTime)}
        </span>
        <input
          type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
          onChange={handleSeek}
          className="flex-1 cursor-pointer"
          style={{ accentColor: accent }}
        />
        <span className="text-white/25 text-[9px] w-7 flex-shrink-0 tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

// ─── Merged result player ─────────────────────────────────────────────────────

function MergedPlayer({ audioUrl, sublabel }: { audioUrl: string; sublabel: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  return (
    <>
      <audio ref={audioRef} src={audioUrl}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />
      <div className="rounded-2xl px-4 py-3.5"
        style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)" }}>
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => { const a = audioRef.current; if (!a) return; playing ? a.pause() : a.play(); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0 active:scale-95"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#4fc3f7)", color: "#05080F" }}>
            {playing ? "⏸" : "▶"}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Merged result</p>
            <p className="text-white/30 text-xs truncate">{sublabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/25 text-[9px] w-7 text-right flex-shrink-0 tabular-nums">{formatTime(currentTime)}</span>
          <input type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
            onChange={(e) => { const a = audioRef.current; if (a) a.currentTime = +e.target.value; }}
            className="flex-1 cursor-pointer" style={{ accentColor: "#8B5CF6" }} />
          <span className="text-white/25 text-[9px] w-7 flex-shrink-0 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>
    </>
  );
}

// ─── Web Audio merge ──────────────────────────────────────────────────────────

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const nc = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
  const pcmLen = len * nc * 2;
  const ab = new ArrayBuffer(44 + pcmLen);
  const v = new DataView(ab);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + pcmLen, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nc, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true);
  v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, pcmLen, true);
  let off = 44;
  for (let i = 0; i < len; i++)
    for (let ch = 0; ch < nc; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
    }
  return new Blob([ab], { type: "audio/wav" });
}

interface MergeOptions {
  speechOffsetSec: number;
  sfxOffsetSec: number;
  sfxVolume: number;
  sfxLoop: boolean;
}

async function mergeAudioInBrowser(speechUrl: string, sfxUrl: string, opts: MergeOptions): Promise<string> {
  const ctx = new AudioContext();
  const [sr, sfr] = await Promise.all([fetch(speechUrl), fetch(sfxUrl)]);
  const [sRaw, sfRaw] = await Promise.all([sr.arrayBuffer(), sfr.arrayBuffer()]);
  const [sBuf, sfBuf] = await Promise.all([ctx.decodeAudioData(sRaw), ctx.decodeAudioData(sfRaw)]);

  const rate = sBuf.sampleRate;
  const sOff = Math.round(opts.speechOffsetSec * rate);
  const sfOff = Math.round(opts.sfxOffsetSec * rate);
  const speechEnd = sOff + sBuf.length;
  const sfxEnd = opts.sfxLoop ? speechEnd : sfOff + sfBuf.length;
  const outLen = Math.max(speechEnd, sfxEnd);
  const nc = Math.max(sBuf.numberOfChannels, sfBuf.numberOfChannels);
  const out = ctx.createBuffer(nc, outLen, rate);

  for (let ch = 0; ch < nc; ch++) {
    const od = out.getChannelData(ch);
    const sd = sBuf.getChannelData(Math.min(ch, sBuf.numberOfChannels - 1));
    const sfd = sfBuf.getChannelData(Math.min(ch, sfBuf.numberOfChannels - 1));
    for (let i = 0; i < sBuf.length; i++) od[sOff + i] += sd[i];
    const sfxSamples = opts.sfxLoop ? speechEnd - sfOff : sfBuf.length;
    for (let i = 0; i < sfxSamples; i++) {
      const idx = sfOff + i;
      if (idx >= 0 && idx < outLen) od[idx] += sfd[i % sfBuf.length] * opts.sfxVolume;
    }
    for (let i = 0; i < outLen; i++) { if (od[i] > 1) od[i] = 1; if (od[i] < -1) od[i] = -1; }
  }

  await ctx.close();
  return URL.createObjectURL(audioBufferToWavBlob(out));
}

// ─── Timing row ───────────────────────────────────────────────────────────────

function TimingRow({ label, color, value, max, onChange }: {
  label: string; color: string; value: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold w-16 flex-shrink-0" style={{ color }}>{label}</span>
      <input type="range" min={0} max={max} step={0.1} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="flex-1 cursor-pointer" style={{ accentColor: color }} />
      <span className="text-white/40 text-[11px] w-10 text-right flex-shrink-0 tabular-nums">{value.toFixed(1)}s</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [mode, setMode] = useState<Mode>("tts");

  // Separate text fields per tab
  const [ttsText, setTtsText] = useState("");
  const [sfxText, setSfxText] = useState("");

  // Clip lists
  const [ttsClips, setTtsClips] = useState<AudioClip[]>([]);
  const [sfxClips, setSfxClips] = useState<AudioClip[]>([]);

  // Selected clips for merge
  const [selectedSpeechId, setSelectedSpeechId] = useState<string | null>(null);
  const [selectedSfxId,    setSelectedSfxId]    = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Timing
  const [speechOffset, setSpeechOffset] = useState(0);
  const [sfxOffset,    setSfxOffset]    = useState(0);
  const [sfxVolume,    setSfxVolume]    = useState(28);
  const [sfxLoop,      setSfxLoop]      = useState(true);

  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
  const [merging,        setMerging]        = useState(false);
  const [mergeError,     setMergeError]     = useState<string | null>(null);

  const currentText = mode === "tts" ? ttsText : sfxText;
  const setCurrentText = mode === "tts" ? setTtsText : setSfxText;

  const handleGenerate = useCallback(async () => {
    if (!currentText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/test-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, text: currentText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const clip: AudioClip = {
        id: crypto.randomUUID(),
        url: data.audioUrl,
        text: currentText.trim(),
      };

      if (mode === "tts") {
        setTtsClips((prev) => [clip, ...prev]);
        // Auto-select the new clip if none selected
        setSelectedSpeechId((prev) => prev ?? clip.id);
      } else {
        setSfxClips((prev) => [clip, ...prev]);
        setSelectedSfxId((prev) => prev ?? clip.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [mode, currentText]);

  const handleMerge = useCallback(async () => {
    const speechClip = ttsClips.find((c) => c.id === selectedSpeechId);
    const sfxClip    = sfxClips.find((c) => c.id === selectedSfxId);
    if (!speechClip || !sfxClip) return;
    setMerging(true);
    setMergeError(null);
    setMergedAudioUrl(null);

    try {
      const url = await mergeAudioInBrowser(speechClip.url, sfxClip.url, {
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
  }, [ttsClips, sfxClips, selectedSpeechId, selectedSfxId, speechOffset, sfxOffset, sfxVolume, sfxLoop]);

  const canGenerate = currentText.trim().length > 0 && !loading;
  const selectedSpeech = ttsClips.find((c) => c.id === selectedSpeechId);
  const selectedSfx    = sfxClips.find((c) => c.id === selectedSfxId);
  const canMerge = !!selectedSpeech && !!selectedSfx && !merging;

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      <div className="px-5 pt-12 pb-36">

        <div className="flex items-center justify-center mb-8">
          <h1 className="text-base font-semibold text-white tracking-wide">Audio Test Lab</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-5 rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["tts", "sfx"] as Mode[]).map((m) => (
            <button key={m}
              onClick={() => { setMode(m); setError(null); }}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
              style={mode === m ? {
                background: "rgba(79,195,247,0.12)", color: "#4fc3f7",
                border: "1px solid rgba(79,195,247,0.25)",
              } : { color: "rgba(255,255,255,0.3)" }}>
              {m === "tts" ? "🎙️ Voice (TTS)" : "🔊 Sound FX"}
            </button>
          ))}
        </div>

        {/* Input — separate per tab */}
        <div className="mb-2">
          <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
            {mode === "tts" ? "Text to speak" : "Sound effect description"}
          </label>
          {mode === "tts" ? (
            <textarea key="tts-input" value={ttsText} onChange={(e) => setTtsText(e.target.value)}
              rows={5}
              placeholder="Type any text and hear it spoken aloud…"
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
          ) : (
            <textarea key="sfx-input" value={sfxText} onChange={(e) => setSfxText(e.target.value)}
              rows={3}
              placeholder="Describe a sound effect, e.g. &quot;thunderstorm with heavy rain&quot;"
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
          )}
        </div>

        {mode === "sfx" && (
          <p className="text-white/20 text-[10px] mb-3">
            Requires <span style={{ color: "rgba(139,92,246,0.6)" }}>ELEVENLABS_API_KEY</span> in .env.local
          </p>
        )}

        {/* Generate */}
        <button onClick={handleGenerate} disabled={!canGenerate}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
          style={canGenerate ? (mode === "tts" ? {
            background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F",
            boxShadow: "0 4px 20px rgba(79,195,247,0.3)",
          } : {
            background: "linear-gradient(90deg,#8B5CF6,#6d44d0)", color: "#fff",
            boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
          }) : {
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">{mode === "tts" ? "🎙️" : "🔊"}</span>
              {mode === "tts" ? "Synthesising…" : "Generating SFX…"}
            </span>
          ) : mode === "tts" ? "+ SYNTHESISE VOICE" : "+ GENERATE SOUND FX"}
        </button>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Clip list for current tab ── */}
        {(mode === "tts" ? ttsClips : sfxClips).length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-1">
              {mode === "tts" ? `Speech clips (${ttsClips.length})` : `SFX clips (${sfxClips.length})`}
            </p>
            {(mode === "tts" ? ttsClips : sfxClips).map((clip) => (
              <ClipPlayer
                key={clip.id}
                clip={clip}
                accent={mode === "tts" ? "#4fc3f7" : "#a78bfa"}
                selected={mode === "tts" ? selectedSpeechId === clip.id : selectedSfxId === clip.id}
                onSelect={() => {
                  if (mode === "tts") setSelectedSpeechId(clip.id);
                  else setSelectedSfxId(clip.id);
                  setMergedAudioUrl(null);
                }}
                onDelete={() => {
                  if (mode === "tts") {
                    setTtsClips((prev) => prev.filter((c) => c.id !== clip.id));
                    if (selectedSpeechId === clip.id) setSelectedSpeechId(null);
                  } else {
                    setSfxClips((prev) => prev.filter((c) => c.id !== clip.id));
                    if (selectedSfxId === clip.id) setSelectedSfxId(null);
                  }
                  setMergedAudioUrl(null);
                }}
              />
            ))}
          </div>
        )}

        {/* ── Merge section ── */}
        {(ttsClips.length > 0 || sfxClips.length > 0) && (
          <div className="mt-6">
            <div className="h-px mb-5" style={{ background: "rgba(255,255,255,0.06)" }} />
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-3">Merge</p>

            {/* Selected-for-merge chips */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${selectedSpeech ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.07)"}` }}>
                <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(79,195,247,0.6)" }}>🎙️ Speech</p>
                <p className="text-white/50 text-[11px] truncate">
                  {selectedSpeech ? selectedSpeech.text.slice(0, 40) + (selectedSpeech.text.length > 40 ? "…" : "") : "— none selected"}
                </p>
              </div>
              <div className="flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${selectedSfx ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}` }}>
                <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(139,92,246,0.6)" }}>🔊 SFX</p>
                <p className="text-white/50 text-[11px] truncate">
                  {selectedSfx ? selectedSfx.text.slice(0, 40) + (selectedSfx.text.length > 40 ? "…" : "") : "— none selected"}
                </p>
              </div>
            </div>

            {/* Timing controls */}
            {canMerge && (
              <div className="rounded-2xl px-4 py-4 mb-4 flex flex-col gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest">Mix Timing</p>

                <TimingRow label="🎙️ Speech" color="#4fc3f7" value={speechOffset} max={10}
                  onChange={(v) => { setSpeechOffset(v); setMergedAudioUrl(null); }} />
                <TimingRow label="🔊 SFX" color="#a78bfa" value={sfxOffset} max={10}
                  onChange={(v) => { setSfxOffset(v); setMergedAudioUrl(null); }} />

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold w-16 flex-shrink-0" style={{ color: "#a78bfa" }}>SFX Vol</span>
                  <input type="range" min={0} max={100} step={1} value={sfxVolume}
                    onChange={(e) => { setSfxVolume(+e.target.value); setMergedAudioUrl(null); }}
                    className="flex-1 cursor-pointer" style={{ accentColor: "#a78bfa" }} />
                  <span className="text-white/40 text-[11px] w-10 text-right flex-shrink-0 tabular-nums">{sfxVolume}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold" style={{ color: "#a78bfa" }}>Loop SFX</span>
                  <button onClick={() => { setSfxLoop((v) => !v); setMergedAudioUrl(null); }}
                    className="w-10 h-6 rounded-full transition-all relative flex-shrink-0"
                    style={{
                      background: sfxLoop ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)",
                      border: sfxLoop ? "1px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.12)",
                    }}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{ left: sfxLoop ? "calc(100% - 22px)" : "2px", background: sfxLoop ? "#a78bfa" : "rgba(255,255,255,0.3)" }} />
                  </button>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-white/15 text-[9px] uppercase tracking-widest mb-1.5">Timeline preview</p>
                  <div className="relative h-7 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="absolute top-1 h-2.5 rounded-sm opacity-70"
                      style={{ left: `${(speechOffset / 12) * 100}%`, width: "40%", background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", maxWidth: `${100 - (speechOffset / 12) * 100}%` }} />
                    <div className="absolute bottom-1 h-2.5 rounded-sm opacity-60"
                      style={{ left: `${(sfxOffset / 12) * 100}%`, width: sfxLoop ? `${100 - (sfxOffset / 12) * 100}%` : "30%", background: "linear-gradient(90deg,#8B5CF6,#a78bfa)", maxWidth: `${100 - (sfxOffset / 12) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-white/15 text-[9px] mt-0.5">
                    <span>0s</span><span>6s</span><span>12s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Merge button */}
            <button onClick={handleMerge} disabled={!canMerge}
              className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={canMerge ? {
                background: "linear-gradient(90deg,#8B5CF6,#4fc3f7)", color: "#05080F",
                boxShadow: "0 4px 24px rgba(139,92,246,0.35)",
              } : {
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
              {merging ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">🎚️</span>Merging…
                </span>
              ) : !selectedSpeech || !selectedSfx
                ? `Select ${!selectedSpeech ? "a speech" : "an SFX"} clip first`
                : "🎚️  MERGE SPEECH + SFX"}
            </button>

            {mergeError && (
              <div className="mt-3 px-4 py-3 rounded-2xl text-xs"
                style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
                ⚠ {mergeError}
              </div>
            )}

            {mergedAudioUrl && (
              <div className="mt-3">
                <MergedPlayer audioUrl={mergedAudioUrl}
                  sublabel={`Speech +${speechOffset}s · SFX +${sfxOffset}s · ${sfxVolume}% vol${sfxLoop ? " · looped" : ""}`} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
