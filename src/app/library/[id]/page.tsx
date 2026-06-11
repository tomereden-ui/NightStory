"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { LibraryEntry } from "@/lib/libraryStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetch(`/api/library/${id}`)
      .then((r) => r.json())
      .then((data) => setEntry("id" in data ? data : null))
      .catch(() => setEntry(null))
      .finally(() => setLoading(false));
  }, [id]);

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

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#0A0C14" }}>
        <span className="text-white/30 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4" style={{ background: "#0A0C14" }}>
        <span className="text-4xl">🌙</span>
        <p className="text-white/30 text-sm">Story not found.</p>
        <button onClick={() => router.back()} className="text-xs text-white/40 underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: "#0A0C14" }}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={entry.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* Scrollable content with bottom padding for player */}
      <div className="px-5 pt-12 pb-48">
        {/* Header */}
        <div className="flex items-center mb-2">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center text-white/50 text-base flex-shrink-0"
          >
            ←
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide truncate px-2">
            {entry.title}
          </h1>
          <div className="w-8" />
        </div>

        <p className="text-center text-white/20 text-[11px] mb-6">
          {timeAgo(entry.createdAt)} · {Math.round(entry.durationSeconds / 60)} min
        </p>

        {/* Cover image */}
        {entry.coverUrl && (
          <div className="mb-7 rounded-2xl overflow-hidden w-full aspect-square max-w-xs mx-auto"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Script blocks */}
        <div className="flex flex-col gap-3">
          {entry.blocks.map((block) => {
            const isNarrator = block.characterName.toLowerCase().includes("narrat");
            return (
              <div
                key={block.id}
                className="px-4 py-3 rounded-2xl"
                style={{
                  background: isNarrator
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,212,255,0.05)",
                  border: isNarrator
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid rgba(0,212,255,0.12)",
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: isNarrator ? "rgba(255,255,255,0.3)" : "#00D4FF" }}
                >
                  {block.characterName}
                </p>
                <p className="text-white/70 text-sm leading-relaxed">
                  {block.textPayload}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky audio player */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-6"
        style={{ background: "linear-gradient(to top, #0A0C14 75%, transparent)" }}
      >
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: "rgba(15,18,28,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Title row */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handlePlayPause}
              className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#00D4FF,#00A8C8)" }}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-snug">{entry.title}</p>
              <p className="text-white/30 text-xs">{entry.summary.split(" ").slice(0, 6).join(" ")}…</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-white/30 text-[10px] w-8 text-right flex-shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || entry.durationSeconds}
              step={0.5}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 cursor-pointer"
              style={{ accentColor: "#00D4FF" }}
            />
            <span className="text-white/30 text-[10px] w-8 flex-shrink-0">
              {formatTime(duration || entry.durationSeconds)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
