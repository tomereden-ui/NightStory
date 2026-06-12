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

  const activeTrack = dialogueTracks.find((t, i) => {
    const nextStart = dialogueTracks[i + 1]?.start_ms ?? Infinity;
    return (
      currentTime * 1000 >= t.start_ms &&
      currentTime * 1000 < nextStart
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Title card */}
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
            {voiceAssignments[activeTrack.character?.toLowerCase() ?? ""] && (
              <span className="text-white/25 normal-case font-normal tracking-normal ml-2">
                · {voiceAssignments[activeTrack.character?.toLowerCase() ?? ""]}
              </span>
            )}
          </p>
          <p className="text-white/75 text-sm leading-relaxed">{activeTrack.line}</p>
        </div>
      )}

      {/* Voice cast */}
      {Object.keys(voiceAssignments).length > 0 && (
        <div
          className="px-4 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Cast</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(voiceAssignments).map(([char, voice]) => (
              <span
                key={char}
                className="text-[10px] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(79,195,247,0.08)", color: "rgba(79,195,247,0.7)", border: "1px solid rgba(79,195,247,0.15)" }}
              >
                {char} · {voice}
              </span>
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
              const width = t.type === "sfx" && t.loop
                ? 100 - left
                : Math.max(1, ((t.duration_hint_ms ?? 1500) / 1000 / duration) * 100);
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
                          ? "rgba(139,92,246,0.5)"
                          : "rgba(245,158,11,0.5)"
                        : "rgba(79,195,247,0.5)",
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
