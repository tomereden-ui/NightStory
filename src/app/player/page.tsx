"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
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
  const { language, t, isRTL } = useLanguage();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(22);

  const story = (params.get("id") ? STORIES.find((s) => s.id === params.get("id")) : null) ?? STORIES[5];
  const title = language === "he" && story.titleHe ? story.titleHe : story.title;
  const currentSec = Math.round((progress / 100) * story.durationSeconds);

  return (
    <div className="relative min-h-full flex flex-col bg-bg" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={30} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 pt-12 pb-3">
        <Link href="/library" className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors text-sm">
          ←
        </Link>
        <p className="text-white/70 text-sm font-semibold truncate max-w-[55%] text-center">{title}</p>
        <button className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 text-sm">
          ↑
        </button>
      </div>

      {/* Scrollable narrative */}
      <div className="relative flex-1 overflow-y-auto px-5 py-2 flex flex-col gap-2.5">
        {SEGMENTS.map((seg, i) => (
          <div key={i} className="animate-float-up" style={{ animationDelay: `${i * 0.08}s` }}>
            {seg.type === "narrator" ? (
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 border" style={{ background: "#0E1225", borderColor: "rgba(139,92,246,0.15)" }}>
                <p className="text-purple-bright/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">{seg.speaker}</p>
                <p className="text-white/65 text-sm leading-relaxed">{seg.text}</p>
              </div>
            ) : (
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 border ml-3" style={{ background: "#0A1220", borderColor: "rgba(0,212,255,0.12)" }}>
                <p className="text-teal/70 text-[10px] font-bold uppercase tracking-widest mb-1.5">{seg.speaker}</p>
                <p className="text-white/80 text-sm leading-relaxed italic">"{seg.text}"</p>
              </div>
            )}
          </div>
        ))}
        <div className="h-4" />
      </div>

      {/* Player panel */}
      <div className="relative px-4 pb-3">
        <div className="rounded-3xl px-4 pt-3 pb-4 border border-white/5" style={{ background: "linear-gradient(135deg,#0E1225,#080B18)" }}>
          {/* Story row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border border-white/5 flex-shrink-0"
              style={{ background: story.coverGradient ?? story.coverColor }}>
              {story.coverEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{title}</p>
              <p className="text-white/30 text-xs">{story.voice.avatarEmoji} {language === "he" ? story.voice.nameHe : story.voice.name}</p>
            </div>
            <button className="text-pink/60 hover:text-pink text-lg transition-colors">
              {story.isFavorite ? "♥" : "♡"}
            </button>
          </div>

          {/* Progress */}
          <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(+e.target.value)}
            className="w-full accent-purple cursor-pointer mb-1" />
          <div className="flex justify-between text-white/20 text-[10px] mb-3">
            <span>{formatTime(currentSec)}</span>
            <span>{formatTime(story.durationSeconds)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button className="text-white/25 text-xl w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">⏮</button>
            <button className="text-white/25 text-lg w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">«</button>
            <button onClick={() => setPlaying(!playing)}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-purple active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 20px rgba(139,92,246,0.5)" }}>
              {playing ? "⏸" : "▶"}
            </button>
            <button className="text-white/25 text-lg w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors">»</button>
            <button className="text-white/25 text-sm w-9 h-9 flex items-center justify-center hover:text-white/50 transition-colors border border-white/10 rounded-xl">
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
