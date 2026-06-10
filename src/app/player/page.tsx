"use client";

import { useState, useRef, useCallback, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { STORIES } from "@/lib/mockData";

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const SEGMENTS = [
  { type: "narrator", speaker: "Narrator", text: "Once upon a time, in a valley where the stars always danced a little too fast, there lived a child named Pixel." },
  { type: "character", speaker: "Pixel (The Robot)", text: "Wait! I can hear the constellations talking from the Giant Celestial Cloud!" },
  { type: "narrator", speaker: "Narrator", text: "Pixel had a mind full of shiny chrome, lots of intellectual support and clicking gears that hummed a quiet lullaby." },
  { type: "character", speaker: "Nova (Fairy)", text: "Be careful, little one. The stars are fragile tonight." },
];

function PlayerContent() {
  const params = useSearchParams();
  const { language, isRTL } = useLanguage();
  const [playing, setPlaying] = useState(false);
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const segmentIndexRef = useRef(0);

  // Warm up speech synthesis — Chrome requires voices to be loaded
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const story = (params.get("id") ? STORIES.find((s) => s.id === params.get("id")) : null) ?? STORIES[5];
  const title = language === "he" && story.titleHe ? story.titleHe : story.title;
  const currentSec = Math.round((progress / 100) * story.durationSeconds);

  const speakSegment = useCallback((index: number) => {
    if (index >= SEGMENTS.length) {
      setPlaying(false);
      setActiveSegment(null);
      setProgress(100);
      return;
    }
    const seg = SEGMENTS[index];
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(seg.text);
    utterance.lang = "en-US";
    utterance.rate = seg.type === "narrator" ? 0.9 : 1.0;
    utterance.pitch = seg.type === "character" ? 1.15 : 1.0;
    utterance.volume = 1;

    // Explicitly set a local English voice — Chrome on Windows silently fails without this
    const available = synth.getVoices();
    const pick = available.find((v) => v.lang.startsWith("en") && v.localService)
      ?? available.find((v) => v.lang.startsWith("en"))
      ?? available[0];
    if (pick) utterance.voice = pick;

    utterance.onstart = () => {
      setActiveSegment(index);
      setProgress(Math.round((index / SEGMENTS.length) * 100));
    };
    utterance.onend = () => {
      segmentIndexRef.current = index + 1;
      speakSegment(index + 1);
    };
    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error", e);
      setPlaying(false);
      setActiveSegment(null);
    };
    synth.speak(utterance);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playing) {
      window.speechSynthesis.pause();
      setPlaying(false);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPlaying(true);
    } else {
      window.speechSynthesis.cancel();
      segmentIndexRef.current = 0;
      setPlaying(true);
      // 150ms gap after cancel — needed for Chrome to reset properly
      setTimeout(() => speakSegment(0), 150);
    }
  }, [playing, speakSegment]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setActiveSegment(null);
    setProgress(0);
    segmentIndexRef.current = 0;
  }, []);

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#0A0C14" }} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3">
        <Link href="/library"
          className="w-8 h-8 flex items-center justify-center text-white/40 text-base">
          ←
        </Link>
        <p className="text-white text-sm font-semibold truncate max-w-[55%] text-center">{title}</p>
        <button onClick={handleStop}
          className="w-8 h-8 flex items-center justify-center text-white/30 text-base transition-colors hover:text-white/60">
          ■
        </button>
      </div>

      {/* Scrollable narrative */}
      <div className="flex-1 overflow-y-auto px-5 py-2 flex flex-col gap-2.5">
        {SEGMENTS.map((seg, i) => {
          const isActive = activeSegment === i;
          return (
            <div key={i}>
              {seg.type === "narrator" ? (
                <div
                  className="rounded-2xl px-4 py-3 transition-all"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                    border: isActive ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: isActive ? "0 0 16px rgba(0,212,255,0.08)" : "none",
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{seg.speaker}</p>
                    {isActive && (
                      <span className="flex gap-0.5 items-end h-3">
                        {[1,2,3].map((j) => (
                          <span key={j} className="w-0.5 rounded-full"
                            style={{ background: "#00D4FF", height: `${8 + j * 4}px`, animation: `bounce 0.5s ease-in-out ${j * 0.1}s infinite` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="text-white/65 text-sm leading-relaxed">{seg.text}</p>
                </div>
              ) : (
                <div
                  className="rounded-2xl px-4 py-3 ml-3 transition-all"
                  style={{
                    background: isActive ? "rgba(0,212,255,0.06)" : "rgba(0,212,255,0.03)",
                    border: isActive ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(0,212,255,0.08)",
                    boxShadow: isActive ? "0 0 16px rgba(0,212,255,0.08)" : "none",
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(0,212,255,0.6)" }}>{seg.speaker}</p>
                    {isActive && (
                      <span className="flex gap-0.5 items-end h-3">
                        {[1,2,3].map((j) => (
                          <span key={j} className="w-0.5 rounded-full"
                            style={{ background: "#00D4FF", height: `${8 + j * 4}px`, animation: `bounce 0.5s ease-in-out ${j * 0.1}s infinite` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed italic">"{seg.text}"</p>
                </div>
              )}
            </div>
          );
        })}
        <div className="h-4" />
      </div>

      {/* Player panel */}
      <div className="px-4 pb-3">
        <div
          className="rounded-3xl px-4 pt-3 pb-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Story row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden"
              style={{ background: story.coverGradient ?? story.coverColor }}>
              {story.coverEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{title}</p>
              <p className="text-white/30 text-xs">{story.voice.avatarEmoji} {language === "he" ? story.voice.nameHe : story.voice.name}</p>
            </div>
            <button className="text-white/25 text-lg hover:text-white/50 transition-colors">
              {story.isFavorite ? "♥" : "♡"}
            </button>
          </div>

          {/* Progress */}
          <input type="range" min={0} max={100} value={progress}
            onChange={(e) => setProgress(+e.target.value)}
            className="w-full cursor-pointer mb-1"
            style={{ accentColor: "#00D4FF" }} />
          <div className="flex justify-between text-white/20 text-[10px] mb-3">
            <span>{formatTime(currentSec)}</span>
            <span>{formatTime(story.durationSeconds)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button onClick={handleStop} className="text-white/25 text-xl w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">⏮</button>
            <button className="text-white/25 text-lg w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">«</button>
            <button
              onClick={handlePlayPause}
              className="w-14 h-14 rounded-full flex items-center justify-center text-bg text-xl active:scale-95 transition-transform font-bold"
              style={{
                background: "linear-gradient(135deg,#00D4FF,#00A8C8)",
                boxShadow: "0 4px 20px rgba(0,212,255,0.4)",
                color: "#0A0C14",
              }}>
              {playing ? "⏸" : "▶"}
            </button>
            <button className="text-white/25 text-lg w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">»</button>
            <button
              className="text-white/25 text-sm w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors rounded-xl"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[80vh]"><span className="text-4xl animate-pulse-slow">✨</span></div>}>
      <PlayerContent />
    </Suspense>
  );
}
