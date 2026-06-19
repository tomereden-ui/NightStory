"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Job } from "@/lib/jobs";
import type { DramaScript, DramaTrack } from "@/lib/services/dramaPlanner";

interface Props {
  job: Job;
  onGenerateAnother: () => void;
}

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export default function DramaPlayer({ job, onGenerateAnother }: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scriptOpen, setScriptOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const script = job.scriptJson as DramaScript | undefined;
  const tracks: DramaTrack[] = script?.tracks ?? [];
  const dialogueTracks = tracks.filter((t) => t.type === "dialogue");
  const sfxTracks = tracks.filter((t) => t.type === "sfx");
  const voiceAssignments = job.voiceAssignments ?? {};

  useEffect(() => {
    if (!job.audioUrl) return;
    const audio = new Audio(job.audioUrl);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onended = () => { setPlaying(false); setCurrentTime(0); };
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [job.audioUrl]);

  useEffect(() => {
    if (playing) {
      timerRef.current = window.setInterval(() => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      }, 250);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(console.error);
      setPlaying(true);
    }
  }, [playing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = +e.target.value;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  // Character palette — cycles through cosmic accent colours
  const CAST_PALETTE = [
    { bg: "rgba(79,195,247,0.12)",  border: "rgba(79,195,247,0.35)",  glow: "rgba(79,195,247,0.15)",  text: "#4fc3f7"  },
    { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)", glow: "rgba(139,92,246,0.15)", text: "#a78bfa" },
    { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", glow: "rgba(245,158,11,0.15)", text: "#F59E0B" },
    { bg: "rgba(16,217,160,0.12)", border: "rgba(16,217,160,0.35)", glow: "rgba(16,217,160,0.15)", text: "#10D9A0" },
    { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.35)", glow: "rgba(236,72,153,0.15)", text: "#EC4899" },
    { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", glow: "rgba(251,191,36,0.15)", text: "#FBBF24" },
  ];

  const castMembers = Object.keys(voiceAssignments)
    .filter((name) => !/^(sfx|sound)/i.test(name.trim()))
    .map((name, i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      initial: name.charAt(0).toUpperCase(),
      color: CAST_PALETTE[i % CAST_PALETTE.length],
    }));

  const nowMs = currentTime * 1000;
  const activeTrack = dialogueTracks.find((t) => {
    const end = t.end_ms ?? Infinity;
    return nowMs >= t.start_ms && nowMs < end;
  });

  return (
    <div className="flex flex-col gap-4">
      {job.libraryError && (
        <div
          className="px-4 py-3 rounded-2xl text-xs"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B" }}
        >
          ⚠️ Your drama was produced successfully, but saving it to your Library failed. Download it now so you don't lose it — try producing again later to retry the save.
        </div>
      )}
      {/* Title card */}
      {job.coverUrl ? (
        <div className="rounded-2xl overflow-hidden relative" style={{ border: "1px solid rgba(79,195,247,0.15)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.coverUrl} alt={job.title ?? "Cover"} className="w-full object-cover" style={{ maxHeight: 280 }} />
          <div className="absolute inset-x-0 bottom-0 px-4 py-3" style={{ background: "linear-gradient(to top, rgba(5,8,15,0.92) 0%, transparent 100%)" }}>
            <p className="text-white font-bold text-base truncate">{job.title ?? "Your Audio Drama"}</p>
            <p className="text-white/45 text-xs mt-0.5">
              {dialogueTracks.length} lines · {sfxTracks.length} SFX ·{" "}
              {formatTime(job.scriptJson ? (job.scriptJson as DramaScript).duration_estimate_seconds : 0)}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="px-5 py-4 rounded-2xl flex items-center gap-3"
          style={{ background: "rgba(79,195,247,0.05)", border: "1px solid rgba(79,195,247,0.15)" }}
        >
          <span className="text-3xl">🎭</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{job.title ?? "Your Audio Drama"}</p>
            <p className="text-white/35 text-xs mt-0.5">
              {dialogueTracks.length} lines · {sfxTracks.length} SFX ·{" "}
              {formatTime(job.scriptJson ? (job.scriptJson as DramaScript).duration_estimate_seconds : 0)}
            </p>
          </div>
          {job.skippedLines?.length ? (
            <span className="text-[9px] text-yellow-400/70 bg-yellow-400/10 px-2 py-0.5 rounded-full">
              {job.skippedLines.length} skipped
            </span>
          ) : (
            <span className="text-[9px] text-teal bg-teal/10 px-2 py-0.5 rounded-full">Full mix</span>
          )}
        </div>
      )}

      {/* Audio player */}
      <div
        className="px-4 pt-4 pb-5 rounded-3xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Progress */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full cursor-pointer mb-1"
          style={{ accentColor: "#4fc3f7" }}
        />
        <div className="flex justify-between text-white/20 text-[10px] mb-4">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); } }}
            className="text-white/25 text-xl w-10 h-10 flex items-center justify-center"
          >
            ⏮
          </button>
          <button
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 20px rgba(79,195,247,0.4)" }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <a
            href={job.audioUrl}
            download={`${job.title ?? "drama"}.mp3`}
            className="text-white/25 text-xl w-10 h-10 flex items-center justify-center hover:text-white/60 transition-colors"
          >
            ↓
          </a>
        </div>
      </div>

      {/* Active line highlight */}
      {activeTrack && (
        <div
          className="px-4 py-3 rounded-2xl"
          style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.25)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#4fc3f7" }}>
            {activeTrack.character}
          </p>
          <p className="text-white/75 text-sm leading-relaxed">{activeTrack.line}</p>
        </div>
      )}

      {/* Voice cast */}
      {castMembers.length > 0 && (
        <div
          className="px-4 py-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Cast</p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {castMembers.map(({ name, color, initial }) => (
              <div key={name} className="flex flex-col items-center gap-2 flex-shrink-0" style={{ minWidth: 64 }}>
                {/* Avatar */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold relative overflow-hidden"
                  style={{ background: color.bg, border: `1.5px solid ${color.border}`, boxShadow: `0 4px 16px ${color.glow}` }}
                >
                  <span style={{ color: color.text }}>{initial}</span>
                  {/* Shine overlay */}
                  <div className="absolute inset-0 opacity-30" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)" }} />
                </div>
                {/* Name */}
                <p className="text-white/70 text-[11px] font-semibold text-center leading-tight" style={{ maxWidth: 64 }}>
                  {name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track timeline */}
      {duration > 0 && tracks.length > 0 && (
        <div
          className="px-4 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Timeline</p>
          <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            {tracks.map((t) => {
              const left = (t.start_ms / 1000 / duration) * 100;
              // Use actual end_ms if stamped (post-mix); fall back to word-count estimate
              const actualDurMs = t.end_ms ? t.end_ms - t.start_ms : null;
              const dialogueMs = actualDurMs
                ?? (t.line
                  ? Math.max(600, t.line.replace(/\[.*?\]/g, "").trim().split(/\s+/).filter(Boolean).length * 380)
                  : 600);
              const width = t.type === "sfx" && t.loop
                ? 100 - left
                : Math.max(1, ((t.type === "sfx" ? t.duration_hint_ms ?? 1500 : dialogueMs) / 1000 / duration) * 100);
              return (
                <div
                  key={t.id}
                  className="absolute top-0 h-full rounded-sm opacity-60"
                  style={{
                    left: `${left}%`,
                    width: `${Math.min(width, 100 - left)}%`,
                    background:
                      t.type === "sfx"
                        ? t.loop
                          ? "rgba(139,92,246,0.7)"
                          : "rgba(245,158,11,0.7)"
                        : "rgba(79,195,247,0.7)",
                  }}
                  title={t.type === "dialogue" ? `${t.character}: ${t.line?.slice(0, 40)}` : t.description}
                />
              );
            })}
            {/* Playhead */}
            <div
              className="absolute top-0 w-0.5 h-full"
              style={{
                left: `${(currentTime / duration) * 100}%`,
                background: "#ffffff",
                opacity: 0.6,
                transition: "left 0.25s linear",
              }}
            />
          </div>
          <div className="flex gap-3 mt-2">
            {[
              { color: "rgba(79,195,247,0.7)",   label: "Dialogue" },
              { color: "rgba(139,92,246,0.7)",  label: "Ambient" },
              { color: "rgba(245,158,11,0.7)",  label: "SFX" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                <span className="text-[9px] text-white/30">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Script viewer (collapsible) */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => setScriptOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-white/40"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span className="font-bold uppercase tracking-widest">View Script</span>
          <span>{scriptOpen ? "▲" : "▼"}</span>
        </button>
        {scriptOpen && (
          <div className="px-4 pb-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
            {dialogueTracks.map((t) => (
              <div key={t.id} className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#4fc3f7" }}>
                  {t.character}
                </span>
                <span className="text-xs text-white/55 leading-relaxed">{t.line}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={job.audioUrl}
          download
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-center active:scale-95 transition-transform"
          style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F" }}
        >
          ↓ Download MP3
        </a>
        <button
          onClick={onGenerateAnother}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white/60"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Create Another
        </button>
      </div>
    </div>
  );
}
