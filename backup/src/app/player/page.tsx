"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { STORIES } from "@/lib/mockData";

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const SEGMENTS = [
  { type: "narrator",  speaker: "Narrator",        text: "Once upon a time, in a valley where the stars always danced a little too fast, there lived a child named Pixel." },
  { type: "character", speaker: "Pixel (The Robot)", text: "Wait! I can hear the constellations talking from the Giant Celestial Cloud!" },
  { type: "narrator",  speaker: "Narrator",         text: "Pixel had a mind full of shiny chrome, with clicking gears that hummed a quiet lullaby." },
  { type: "character", speaker: "Nova (Fairy)",     text: "Be careful, little one. The stars are fragile tonight." },
];

async function base64ToAudioUrl(base64: string, mimeType: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

async function generateSegmentAudio(text: string, speaker: string): Promise<string> {
  const res = await fetch("/api/synthesize-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, characterName: speaker }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "TTS failed");
  return base64ToAudioUrl(data.audioData, data.mimeType ?? "audio/wav");
}

function PlayerContent() {
  const params = useSearchParams();
  const { language, isRTL } = useLanguage();

  const [phase, setPhase]           = useState<"idle" | "preparing" | "playing" | "paused">("idle");
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [activeSegment, setActiveSegment]     = useState<number | null>(null);
  const [progress, setProgress]               = useState(0);
  const [error, setError]                     = useState<string | null>(null);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const urlsRef     = useRef<string[]>([]);
  const segIdxRef   = useRef(0);

  const story = (params.get("id") ? STORIES.find((s) => s.id === params.get("id")) : null) ?? STORIES[5];
  const title = language === "he" && story.titleHe ? story.titleHe : story.title;
  const currentSec  = Math.round((progress / 100) * story.durationSeconds);

  // Clean up blob URLs
  const clearUrls = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    clearUrls();
    setPhase("idle");
    setActiveSegment(null);
    setProgress(0);
    segIdxRef.current = 0;
  }, [clearUrls]);

  const playIndex = useCallback((index: number, urls: string[]) => {
    if (index >= urls.length) {
      setPhase("idle");
      setActiveSegment(null);
      setProgress(100);
      return;
    }
    const audio = new Audio(urls[index]);
    audioRef.current = audio;
    audio.onplay = () => {
      setActiveSegment(index);
      setProgress(Math.round((index / urls.length) * 100));
    };
    audio.onended = () => {
      segIdxRef.current = index + 1;
      playIndex(index + 1, urls);
    };
    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      setError("Audio playback failed — check console for details");
      setPhase("idle");
      setActiveSegment(null);
    };
    audio.play().catch((e: unknown) => {
      console.error("audio.play() rejected:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Playback blocked: ${msg}`);
      setPhase("idle");
      setActiveSegment(null);
    });
  }, [setError]);

  const handlePlay = useCallback(async () => {
    if (phase === "paused" && audioRef.current) {
      await audioRef.current.play();
      setPhase("playing");
      return;
    }
    if (phase === "playing" && audioRef.current) {
      audioRef.current.pause();
      setPhase("paused");
      return;
    }

    // Fresh start — generate all segments
    stopPlayback();
    setPhase("preparing");
    setPrepareProgress(0);
    setError(null);

    try {
      const urls: string[] = [];
      for (let i = 0; i < SEGMENTS.length; i++) {
        const url = await generateSegmentAudio(SEGMENTS[i].text, SEGMENTS[i].speaker);
        urls.push(url);
        urlsRef.current = [...urls];
        setPrepareProgress(Math.round(((i + 1) / SEGMENTS.length) * 100));
      }
      setPhase("playing");
      segIdxRef.current = 0;
      playIndex(0, urls);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Audio generation failed");
      setPhase("idle");
    }
  }, [phase, stopPlayback, playIndex]);

  const handleStop = useCallback(() => stopPlayback(), [stopPlayback]);

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#0A0C14" }} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3">
        <Link href="/library" className="w-8 h-8 flex items-center justify-center text-white/40 text-base">←</Link>
        <p className="text-white text-sm font-semibold truncate max-w-[55%] text-center">{title}</p>
        <button onClick={handleStop} className="w-8 h-8 flex items-center justify-center text-white/30 text-base hover:text-white/60 transition-colors">■</button>
      </div>

      {/* Preparing overlay */}
      {phase === "preparing" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ background: "radial-gradient(circle,#00D4FF,#0088AA)" }} />
            <span className="relative text-4xl animate-pulse">🎙️</span>
          </div>
          <div>
            <p className="text-white font-semibold mb-1">Preparing story voices…</p>
            <p className="text-white/35 text-sm">Generating natural AI speech ({prepareProgress}%)</p>
          </div>
          <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${prepareProgress}%`, background: "linear-gradient(90deg,#00D4FF,#0088AA)" }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && phase === "idle" && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-2xl text-sm"
          style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
          ⚠ {error}
        </div>
      )}

      {/* Segments */}
      {phase !== "preparing" && (
        <div className="flex-1 overflow-y-auto px-5 py-2 flex flex-col gap-2.5">
          {SEGMENTS.map((seg, i) => {
            const isActive = activeSegment === i;
            return (
              <div key={i} className="rounded-2xl px-4 py-3 transition-all"
                style={{
                  background: isActive ? "rgba(0,212,255,0.06)" : "rgba(255,255,255,0.03)",
                  border: isActive ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isActive ? "0 0 16px rgba(0,212,255,0.08)" : "none",
                }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: seg.type === "narrator" ? "rgba(255,255,255,0.35)" : "rgba(0,212,255,0.6)" }}>
                    {seg.speaker}
                  </p>
                  {isActive && (
                    <span className="flex gap-0.5 items-end h-3">
                      {[1,2,3].map((j) => (
                        <span key={j} className="w-0.5 rounded-full"
                          style={{ background: "#00D4FF", height: `${8 + j * 4}px`, animation: `bounce 0.5s ease-in-out ${j * 0.1}s infinite` }} />
                      ))}
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${seg.type === "character" ? "italic" : ""}`}
                  style={{ color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)" }}>
                  {seg.type === "character" ? `"${seg.text}"` : seg.text}
                </p>
              </div>
            );
          })}
          <div className="h-4" />
        </div>
      )}

      {/* Player panel */}
      <div className="px-4 pb-3">
        <div className="rounded-3xl px-4 pt-3 pb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Story row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden"
              style={{ background: story.coverGradient ?? story.coverColor }}>
              {story.coverEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{title}</p>
              <p className="text-white/30 text-xs">Gemini AI · Natural Voice</p>
            </div>
            <button className="text-white/25 text-lg hover:text-white/50 transition-colors">
              {story.isFavorite ? "♥" : "♡"}
            </button>
          </div>

          {/* Progress */}
          <input type="range" min={0} max={100} value={progress}
            onChange={(e) => setProgress(+e.target.value)}
            className="w-full cursor-pointer mb-1" style={{ accentColor: "#00D4FF" }} />
          <div className="flex justify-between text-white/20 text-[10px] mb-3">
            <span>{formatTime(currentSec)}</span>
            <span>{formatTime(story.durationSeconds)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button onClick={handleStop} className="text-white/25 text-xl w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">⏮</button>
            <button className="text-white/25 text-lg w-9 h-9 flex items-center justify-center">«</button>
            <button onClick={handlePlay}
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl active:scale-95 transition-transform font-bold"
              style={{ background: "linear-gradient(135deg,#00D4FF,#00A8C8)", color: "#0A0C14", boxShadow: "0 4px 20px rgba(0,212,255,0.4)" }}>
              {phase === "preparing" ? "…" : phase === "playing" ? "⏸" : "▶"}
            </button>
            <button className="text-white/25 text-lg w-9 h-9 flex items-center justify-center">»</button>
            <button className="text-white/25 text-sm w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>↗</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[80vh]"><span className="text-4xl animate-pulse">✨</span></div>}>
      <PlayerContent />
    </Suspense>
  );
}
