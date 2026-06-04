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

function PlayerContent() {
  const searchParams = useSearchParams();
  const storyId = searchParams.get("id");
  const { language, t, isRTL } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const story = storyId ? STORIES.find((s) => s.id === storyId) : STORIES[0];

  if (!story) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <span className="text-5xl">😴</span>
        <p className="text-white/50 text-sm">
          {language === "he" ? "בחר סיפור מהספרייה" : "Choose a story from the Library"}
        </p>
        <Link href="/library" className="btn-outline text-sm">
          {t("library")}
        </Link>
      </div>
    );
  }

  const title = language === "he" && story.titleHe ? story.titleHe : story.title;
  const description =
    language === "he" && story.descriptionHe ? story.descriptionHe : story.description;
  const voiceName =
    language === "he" && story.voice.nameHe ? story.voice.nameHe : story.voice.name;

  const currentSec = Math.round((progress / 100) * story.durationSeconds);

  return (
    <div className="relative min-h-full flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={40} />

      {/* Back */}
      <div className="relative px-5 pt-12 pb-4">
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-white/40 text-sm hover:text-white/60 transition-colors"
        >
          <span className={isRTL ? "rotate-180 inline-block" : ""}>←</span>
          {t("library")}
        </Link>
      </div>

      {/* Cover */}
      <div className="relative flex flex-col items-center px-8 flex-1">
        <div
          className="w-56 h-56 rounded-3xl flex items-center justify-center text-8xl shadow-card border border-white/5 mb-8"
          style={{ backgroundColor: story.coverColor }}
        >
          {story.coverEmoji}
        </div>

        {/* Title & meta */}
        <div className={`w-full text-center mb-8 ${isRTL ? "font-hebrew" : ""}`}>
          <h1 className="text-xl font-bold text-white leading-tight mb-1">{title}</h1>
          <p className="text-white/40 text-sm mb-2">
            {story.voice.avatarEmoji} {voiceName}
          </p>
          <p className="text-white/30 text-xs leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full mb-4">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-gold cursor-pointer"
          />
          <div className="flex justify-between text-white/30 text-xs mt-1">
            <span>{formatTime(currentSec)}</span>
            <span>{formatTime(story.durationSeconds)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8 mb-8">
          <button className="text-white/40 hover:text-white/70 transition-colors text-2xl">
            ⏮
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full bg-gold-gradient shadow-gold flex items-center justify-center text-navy text-2xl transition-transform active:scale-95"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button className="text-white/40 hover:text-white/70 transition-colors text-2xl">
            ⏭
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 justify-center">
          {(language === "he" && story.tagsHe ? story.tagsHe : story.tags).map(
            (tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-navy-lighter border border-white/10 text-white/40 text-xs"
              >
                {tag}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[80vh]">
          <span className="text-4xl animate-pulse-slow">🌙</span>
        </div>
      }
    >
      <PlayerContent />
    </Suspense>
  );
}
