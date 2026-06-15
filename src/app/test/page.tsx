"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "tts" | "sfx";
type TtsProvider = "gemini" | "el";

const GEMINI_VOICES = [
  { name: "Zephyr",      trait: "Bright"         },
  { name: "Puck",        trait: "Upbeat"         },
  { name: "Charon",      trait: "Informational"  },
  { name: "Kore",        trait: "Firm"           },
  { name: "Fenrir",      trait: "Excitable"      },
  { name: "Aoede",       trait: "Breezy"         },
  { name: "Leda",        trait: "Youthful"       },
  { name: "Orus",        trait: "Firm"           },
  { name: "Perseus",     trait: "Easy-going"     },
  { name: "Schedar",     trait: "Even"           },
  { name: "Rasalgethi",  trait: "Informational"  },
  { name: "Enceladus",   trait: "Breathy"        },
  { name: "Iapetus",     trait: "Clear"          },
  { name: "Umbriel",     trait: "Easy-going"     },
  { name: "Algenib",     trait: "Gravelly"       },
  { name: "Achernar",    trait: "Soft"           },
  { name: "Gacrux",      trait: "Mature"         },
  { name: "Pulcherrima", trait: "Forward"        },
];

const EL_VOICES = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    trait: "Deep warm"      },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  trait: "Warm expressive"},
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",  trait: "Strong bold"    },
  { id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily",   trait: "Soft gentle"    },
  { id: "SOYHLrjzK2X1ezoPC6cr", name: "Harry",   trait: "Playful young"  },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    trait: "Youthful"       },
  { id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas",  trait: "Wise elder"     },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", trait: "Airy light"     },
];

interface MixClip {
  id: string;
  type: "speech" | "sfx";
  url: string;
  text: string;
  offsetSec: number;
  volume: number;   // 0–1
  loop: boolean;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── WAV encoder ──────────────────────────────────────────────────────────────

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const nc = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
  const pcmLen = len * nc * 2;
  const ab = new ArrayBuffer(44 + pcmLen);
  const v  = new DataView(ab);
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

async function mergeAllClips(clips: MixClip[]): Promise<string> {
  const ctx = new AudioContext();

  // Decode all clips
  const decoded = await Promise.all(
    clips.map(async (clip) => {
      const res = await fetch(clip.url);
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw);
      return { clip, buf };
    }),
  );

  const rate = decoded[0].buf.sampleRate;

  // Find the last speech clip end — looping SFX runs until then
  const speechEnd = Math.max(
    ...decoded
      .filter(({ clip }) => clip.type === "speech")
      .map(({ clip, buf }) => Math.round(clip.offsetSec * rate) + buf.length),
    0,
  );

  // Total output length
  const outLen = Math.max(
    ...decoded.map(({ clip, buf }) => {
      const start = Math.round(clip.offsetSec * rate);
      const end   = clip.loop ? Math.max(speechEnd, start) : start + buf.length;
      return end;
    }),
    rate, // at least 1 second
  );

  const numCh = Math.max(...decoded.map(({ buf }) => buf.numberOfChannels));
  const out   = ctx.createBuffer(numCh, outLen, rate);

  for (const { clip, buf } of decoded) {
    const start = Math.round(clip.offsetSec * rate);
    const loopEnd = clip.loop ? (speechEnd > start ? speechEnd : start + buf.length) : start + buf.length;

    for (let ch = 0; ch < numCh; ch++) {
      const od  = out.getChannelData(ch);
      const src = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
      const samples = loopEnd - start;
      for (let i = 0; i < samples; i++) {
        const idx = start + i;
        if (idx >= 0 && idx < outLen) {
          od[idx] += src[i % buf.length] * clip.volume;
        }
      }
    }
  }

  // Soft clip
  for (let ch = 0; ch < numCh; ch++) {
    const od = out.getChannelData(ch);
    for (let i = 0; i < outLen; i++) {
      if (od[i] >  1) od[i] =  1;
      if (od[i] < -1) od[i] = -1;
    }
  }

  await ctx.close();
  return URL.createObjectURL(audioBufferToWavBlob(out));
}

// ─── Clip card ────────────────────────────────────────────────────────────────

function ClipCard({
  clip,
  index,
  totalDuration,
  onChange,
  onDelete,
}: {
  clip: MixClip;
  index: number;
  totalDuration: number;  // for timeline bar
  onChange: (updated: Partial<MixClip>) => void;
  onDelete: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]   = useState(0);
  const [expanded, setExpanded]   = useState(false);

  const isSpeech = clip.type === "speech";
  const accent   = isSpeech ? "#4fc3f7" : "#a78bfa";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: `${accent}08`,
        border: `1px solid ${accent}30`,
      }}
    >
      <audio
        ref={audioRef} src={clip.url}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        {/* Type badge */}
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
        >
          {isSpeech ? "🎙️" : "🔊"}
        </span>

        {/* Play */}
        <button
          onClick={() => { const a = audioRef.current; if (!a) return; playing ? a.pause() : a.play(); }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 active:scale-95"
          style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
        >
          <span style={{ color: accent }}>{playing ? "⏸" : "▶"}</span>
        </button>

        {/* Text */}
        <p className="flex-1 text-white/60 text-xs truncate min-w-0">{clip.text}</p>

        {/* Expand timing */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0 transition-all"
          style={{
            background: expanded ? `${accent}18` : "rgba(255,255,255,0.04)",
            color: expanded ? accent : "rgba(255,255,255,0.3)",
            border: `1px solid ${expanded ? accent + "40" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {expanded ? "▲ timing" : "▼ timing"}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors text-sm flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Seek bar */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <span className="text-white/20 text-[9px] w-7 text-right flex-shrink-0 tabular-nums">{formatTime(currentTime)}</span>
        <input
          type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
          onChange={(e) => { const a = audioRef.current; if (a) a.currentTime = +e.target.value; }}
          className="flex-1 cursor-pointer" style={{ accentColor: accent }} />
        <span className="text-white/20 text-[9px] w-7 flex-shrink-0 tabular-nums">{formatTime(duration)}</span>
      </div>

      {/* Expanded timing controls */}
      {expanded && (
        <div
          className="px-3 pb-3 flex flex-col gap-3 border-t"
          style={{ borderColor: `${accent}20` }}
        >
          <div className="pt-2" />

          {/* Offset */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold w-14 flex-shrink-0" style={{ color: accent }}>Start at</span>
            <input
              type="range" min={0} max={15} step={0.1} value={clip.offsetSec}
              onChange={(e) => onChange({ offsetSec: +e.target.value })}
              className="flex-1 cursor-pointer" style={{ accentColor: accent }} />
            <span className="text-white/40 text-[11px] w-10 text-right flex-shrink-0 tabular-nums">{clip.offsetSec.toFixed(1)}s</span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold w-14 flex-shrink-0" style={{ color: accent }}>Volume</span>
            <input
              type="range" min={0} max={100} step={1} value={Math.round(clip.volume * 100)}
              onChange={(e) => onChange({ volume: +e.target.value / 100 })}
              className="flex-1 cursor-pointer" style={{ accentColor: accent }} />
            <span className="text-white/40 text-[11px] w-10 text-right flex-shrink-0 tabular-nums">{Math.round(clip.volume * 100)}%</span>
          </div>

          {/* Loop — SFX only */}
          {!isSpeech && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: accent }}>Loop under speech</span>
              <button
                onClick={() => onChange({ loop: !clip.loop })}
                className="w-10 h-6 rounded-full transition-all relative flex-shrink-0"
                style={{
                  background: clip.loop ? `${accent}44` : "rgba(255,255,255,0.08)",
                  border: clip.loop ? `1px solid ${accent}66` : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{ left: clip.loop ? "calc(100% - 22px)" : "2px", background: clip.loop ? accent : "rgba(255,255,255,0.3)" }}
                />
              </button>
            </div>
          )}

          {/* Mini track bar */}
          <div>
            <div className="relative h-3 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              {totalDuration > 0 && (
                <div
                  className="absolute top-0.5 bottom-0.5 rounded-sm opacity-70"
                  style={{
                    left: `${(clip.offsetSec / totalDuration) * 100}%`,
                    width: clip.loop
                      ? `${Math.max(5, 100 - (clip.offsetSec / totalDuration) * 100)}%`
                      : `${Math.max(5, (duration / totalDuration) * 100)}%`,
                    maxWidth: `${100 - (clip.offsetSec / totalDuration) * 100}%`,
                    background: `linear-gradient(90deg,${accent},${accent}88)`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Merged result player ─────────────────────────────────────────────────────

function MergedPlayer({ audioUrl }: { audioUrl: string }) {
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
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)} />
      <div className="rounded-2xl px-4 py-3.5"
        style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.3)" }}>
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => { const a = audioRef.current; if (!a) return; playing ? a.pause() : a.play(); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0 active:scale-95"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#4fc3f7)", color: "#05080F" }}>
            {playing ? "⏸" : "▶"}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Final Mix</p>
            <p className="text-white/30 text-xs">{formatTime(duration)} · browser-mixed WAV</p>
          </div>
          <a href={audioUrl} download="nightstory-mix.wav"
            className="text-[10px] px-2.5 py-1.5 rounded-xl font-semibold flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
            ↓ Save
          </a>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [mode, setMode]       = useState<Mode>("tts");
  const [ttsText, setTtsText] = useState("");
  const [sfxText, setSfxText] = useState("");
  const [clips, setClips]     = useState<MixClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [mergedUrl, setMergedUrl]   = useState<string | null>(null);
  const [merging, setMerging]       = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // TTS provider controls
  const [ttsProvider, setTtsProvider]   = useState<TtsProvider>("gemini");
  const [geminiVoice, setGeminiVoice]   = useState("Kore");
  const [elVoiceId, setElVoiceId]       = useState(EL_VOICES[0].id);
  const [voiceStyle, setVoiceStyle] = useState("");

  const currentText    = mode === "tts" ? ttsText : sfxText;
  const setCurrentText = mode === "tts" ? setTtsText : setSfxText;

  const handleGenerate = useCallback(async () => {
    if (!currentText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const ttsExtras = mode === "tts" ? {
        provider:   ttsProvider,
        voice:      ttsProvider === "gemini" ? geminiVoice : elVoiceId,
        voiceStyle: voiceStyle || undefined,
      } : {};
      const res  = await fetch("/api/test-audio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, text: currentText.trim(), ...ttsExtras }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const clip: MixClip = {
        id:        crypto.randomUUID(),
        type:      mode === "tts" ? "speech" : "sfx",
        url:       data.audioUrl,
        text:      currentText.trim(),
        offsetSec: 0,
        volume:    mode === "tts" ? 1.0 : 0.28,
        loop:      mode === "sfx",
      };
      setClips((prev) => [...prev, clip]);
      setMergedUrl(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [mode, currentText, ttsProvider, geminiVoice, elVoiceId, voiceStyle]);

  const updateClip = useCallback((id: string, updates: Partial<MixClip>) => {
    setClips((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
    setMergedUrl(null);
  }, []);

  const deleteClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setMergedUrl(null);
  }, []);

  const handleMerge = useCallback(async () => {
    if (clips.length < 2) return;
    setMerging(true);
    setMergeError(null);
    setMergedUrl(null);
    try {
      const url = await mergeAllClips(clips);
      setMergedUrl(url);
    } catch (err: unknown) {
      setMergeError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }, [clips]);

  const canGenerate = currentText.trim().length > 0 && !loading;
  const canMerge    = clips.length >= 2 && !merging;

  // Rough total duration for timeline bars (max offset + ~5s clip estimate)
  const totalDuration = Math.max(15, ...clips.map((c) => c.offsetSec + 10));

  const speechCount = clips.filter((c) => c.type === "speech").length;
  const sfxCount    = clips.filter((c) => c.type === "sfx").length;

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      <div className="px-5 pt-12 pb-36">

        <div className="flex items-center justify-center mb-7">
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
                background: m === "tts" ? "rgba(79,195,247,0.12)" : "rgba(139,92,246,0.12)",
                color: m === "tts" ? "#4fc3f7" : "#a78bfa",
                border: `1px solid ${m === "tts" ? "rgba(79,195,247,0.25)" : "rgba(139,92,246,0.25)"}`,
              } : { color: "rgba(255,255,255,0.3)" }}>
              {m === "tts" ? "🎙️ Voice (TTS)" : "🔊 Sound FX"}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="mb-2">
          <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
            {mode === "tts" ? "Text to speak" : "Sound effect description"}
          </label>
          {mode === "tts" ? (
            <textarea key="tts" value={ttsText} onChange={(e) => setTtsText(e.target.value)}
              rows={4} placeholder="Type any text and hear it spoken aloud…"
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
          ) : (
            <textarea key="sfx" value={sfxText} onChange={(e) => setSfxText(e.target.value)}
              rows={3} placeholder={'Describe a sound effect, e.g. "thunderstorm with heavy rain"'}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
          )}
        </div>

        {mode === "sfx" && (
          <p className="text-white/20 text-[10px] mb-3">
            Requires <span style={{ color: "rgba(139,92,246,0.5)" }}>ELEVENLABS_API_KEY</span> in .env.local
          </p>
        )}

        {/* ── TTS provider + voice controls ── */}
        {mode === "tts" && (
          <div className="mt-3 mb-3 flex flex-col gap-3">

            {/* Provider toggle */}
            <div>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Model</p>
              <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {(["gemini", "el"] as TtsProvider[]).map((p) => (
                  <button key={p}
                    onClick={() => setTtsProvider(p)}
                    className="flex-1 py-2 rounded-[10px] text-[11px] font-bold transition-all"
                    style={ttsProvider === p ? {
                      background: p === "gemini" ? "rgba(79,195,247,0.12)" : "rgba(245,158,11,0.12)",
                      color: p === "gemini" ? "#4fc3f7" : "#F59E0B",
                      border: `1px solid ${p === "gemini" ? "rgba(79,195,247,0.25)" : "rgba(245,158,11,0.25)"}`,
                    } : { color: "rgba(255,255,255,0.3)" }}>
                    {p === "gemini" ? "✦ Gemini TTS" : "⚡ ElevenLabs"}
                  </button>
                ))}
              </div>
            </div>

            {/* Gemini voice grid */}
            {ttsProvider === "gemini" && (
              <div>
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Voice</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {GEMINI_VOICES.map((v) => {
                    const active = geminiVoice === v.name;
                    return (
                      <button key={v.name}
                        onClick={() => setGeminiVoice(v.name)}
                        className="px-2 py-2 rounded-xl text-left transition-all"
                        style={{
                          background: active ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(79,195,247,0.35)" : "rgba(255,255,255,0.07)"}`,
                        }}>
                        <p className="text-[11px] font-semibold leading-tight" style={{ color: active ? "#4fc3f7" : "rgba(255,255,255,0.7)" }}>{v.name}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: active ? "rgba(79,195,247,0.6)" : "rgba(255,255,255,0.25)" }}>{v.trait}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EL voice grid */}
            {ttsProvider === "el" && (
              <>
                <div>
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Voice</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EL_VOICES.map((v) => {
                      const active = elVoiceId === v.id;
                      return (
                        <button key={v.id}
                          onClick={() => setElVoiceId(v.id)}
                          className="px-3 py-2 rounded-xl text-left transition-all"
                          style={{
                            background: active ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${active ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)"}`,
                          }}>
                          <p className="text-[11px] font-semibold leading-tight" style={{ color: active ? "#F59E0B" : "rgba(255,255,255,0.7)" }}>{v.name}</p>
                          <p className="text-[9px] mt-0.5" style={{ color: active ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.25)" }}>{v.trait}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-white/20 text-[10px] -mt-1">
                  Requires <span style={{ color: "rgba(245,158,11,0.5)" }}>ELEVENLABS_API_KEY</span> in .env.local
                </p>
              </>
            )}

            {/* Voice style — shared by both providers */}
            {(() => {
              const accent = ttsProvider === "gemini" ? "#4fc3f7" : "#F59E0B";
              const focusColor = ttsProvider === "gemini" ? "rgba(79,195,247,0.4)" : "rgba(245,158,11,0.4)";
              return (
                <div>
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    Voice style <span className="normal-case font-normal text-white/20">(optional — e.g. "warmly", "whispering")</span>
                  </p>
                  <input
                    type="text"
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    placeholder='e.g. "warmly and gently" or "sleepy and slow"'
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", accentColor: accent }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = focusColor)}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                </div>
              );
            })()}
          </div>
        )}

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
          ) : `+ ${mode === "tts" ? "ADD SPEECH CLIP" : "ADD SFX CLIP"}`}
        </button>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-2xl text-xs"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Unified clip list ── */}
        {clips.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest flex-1">
                Mix Tracks ({clips.length})
              </p>
              {speechCount > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(79,195,247,0.1)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.2)" }}>
                  {speechCount} speech
                </span>
              )}
              {sfxCount > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                  {sfxCount} sfx
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {clips.map((clip, i) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  index={i}
                  totalDuration={totalDuration}
                  onChange={(updates) => updateClip(clip.id, updates)}
                  onDelete={() => deleteClip(clip.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Merge section ── */}
        {clips.length >= 2 && (
          <div className="mt-6">
            <div className="h-px mb-5" style={{ background: "rgba(255,255,255,0.06)" }} />

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
                  <span className="animate-pulse">🎚️</span>Merging {clips.length} tracks…
                </span>
              ) : `🎚️  MERGE ALL ${clips.length} TRACKS`}
            </button>

            {mergeError && (
              <div className="mt-3 px-4 py-3 rounded-2xl text-xs"
                style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
                ⚠ {mergeError}
              </div>
            )}

            {mergedUrl && (
              <div className="mt-3">
                <MergedPlayer audioUrl={mergedUrl} />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
