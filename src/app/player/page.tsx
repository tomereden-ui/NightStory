"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import { STORIES, formatDuration } from "@/lib/mockData";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STORY_SEGMENTS = [
  { type: "narrator", text: "Once upon a time, in a land where the stars always danced a little too fast, there lived a child named Pixel." },
  { type: "character", name: "Pixel (The Robot)", text: "Wait! I can hear the constellations talking from the Giant Celestial Cloud!" },
  { type: "narrator", text: "Pixel had a mind full of shiny chrome, lots of intellectual support and clicking gears that hummed a quiet lullaby." },
  { type: "character", name: "Nova (Fairy)", text: "Be careful, little one. The stars are fragile tonight." },
];

function PlayerContent() {
  const searchParams = useSearchParams();
  const storyId = searchParams.get("id");
  const { language, t, isRTL } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(18);

  const story = storyId ? STORIES.find((s) => s.id === storyId) : STORIES[5];
  if (!story) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <span className="text-5xl">😴</span>
        <p className="text-white/40 text-sm">Choose a story from the Library</p>
        <Link href="/library" className="btn-outline text-sm">{t("library")}</Link>
      </div>
    );
  }

  const title = language === "he" && story.titleHe ? story.titleHe : story.title;
  const voiceName = language === "he" && story.voice.nameHe ? story.voice.nameHe : story.voice.name;
  const currentSec = Math.round((progress / 100) * story.durationSeconds);

  return (
    <div className="relative min-h-full flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={30} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 pt-12 pb-4">
        <Link href="/library" className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors">
          ←
        </Link>
        <h2 className="text-sm font-semibold text-white/80 truncate max-w-[60%] text-center">{title}</h2>
        <button className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors text-sm">
          ↑
        </button>
      </div>

      {/* Scrollable narrative */}
      <div className="relative flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-3">
        {STORY_SEGMENTS.map((seg, i) => (
          <div
            key={i}
            className={`animate-float-up ${seg.type === "narrator" ? "" : "ml-2"}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {seg.type === "narrator" ? (
              <div className="bg-bg-card border border-bg-border rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-[10px] text-purple-bright font-medium uppercase tracking-wider mb-1.5">Narrator</p>
                <p className="text-white/70 text-sm leading-relaxed">{seg.text}</p>
              </div>
            ) : (
              <div className="bg-bg-elevated border border-teal/15 rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-[10px] text-teal font-medium uppercase tracking-wider mb-1.5">{seg.name}</p>
                <p className="text-white/80 text-sm leading-relaxed italic">"{seg.text}"</p>
              </div>
            )}
          </div>
        ))}

        {/* Continue reading fade */}
        <div className="h-8 bg-gradient-to-t from-bg to-transparent" />
      </div>

      {/* Player controls */}
      <div className="relative px-5 pb-4">
        <div
          className="rounded-3xl border border-white/5 p-4"
          style={{ background: "linear-gradient(135deg, #0E1225 0%, #080B18 100%)" }}
        >
          {/* Story info */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-white/5 flex-shrink-0"
              style={{ background: story.coverGradient ?? story.coverColor }}
            >
              {story.coverEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{title}</p>
              <p className="text-white/35 text-xs">{story.voice.avatarEmoji} {voiceName}</p>
            </div>
            <button className="text-pink text-lg">{story.isFavorite ? "♥" : "♡"}</button>
          </div>

          {/* Progress */}
          <input
            type="range" min={0} max={100} value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-purple cursor-pointer mb-1"
          />
          <div className="flex justify-between text-white/25 text-[10px] mb-4">
            <span>{formatTime(currentSec)}</span>
            <span>{formatTime(story.durationSeconds)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button className="text-white/30 hover:text-white/60 transition-colors text-xl w-10 h-10 flex items-center justify-center">⏮</button>
            <button className="text-white/30 hover:text-white/60 transition-colors text-xl w-10 h-10 flex items-center justify-center">«</button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-purple transition-transform active:scale-95"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #EC4899)" }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button className="text-white/30 hover:text-white/60 transition-colors text-xl w-10 h-10 flex items-center justify-center">»</button>
            <button className="text-white/30 hover:text-white/60 transition-colors text-base w-10 h-10 flex items-center justify-center">↗</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[80vh]">
        <span className="text-4xl animate-pulse-slow">✨</span>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
