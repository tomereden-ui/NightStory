"use client";

import Link from "next/link";
import type { Story } from "@/types";
import { formatDuration } from "@/lib/mockData";
import { useLanguage } from "@/context/LanguageContext";

interface StoryCardProps {
  story: Story;
  variant?: "featured" | "compact" | "list";
}

export default function StoryCard({ story, variant = "compact" }: StoryCardProps) {
  const { language } = useLanguage();
  const title = language === "he" && story.titleHe ? story.titleHe : story.title;
  const description =
    language === "he" && story.descriptionHe
      ? story.descriptionHe
      : story.description;

  if (variant === "featured") {
    return (
      <Link href={`/player?id=${story.id}`} className="block group">
        <div
          className="relative w-44 rounded-3xl overflow-hidden shadow-card border border-white/5 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]"
          style={{ backgroundColor: story.coverColor }}
        >
          {/* Stars decoration */}
          <div className="absolute top-3 right-3 text-xs text-white/40">✦</div>
          <div className="absolute top-6 right-7 text-xs text-white/20">·</div>

          {/* Emoji cover */}
          <div className="flex items-center justify-center h-36 text-6xl">
            {story.coverEmoji}
          </div>

          {/* Info */}
          <div className="p-3 bg-gradient-to-t from-black/60 to-transparent">
            {story.isFavorite && (
              <span className="text-xs text-gold">♥ </span>
            )}
            <h3 className="text-white text-xs font-semibold leading-tight line-clamp-2">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/50 text-[10px]">
                {story.voice.avatarEmoji} {language === "he" ? story.voice.nameHe : story.voice.name}
              </span>
              <span className="text-white/30 text-[10px]">
                {formatDuration(story.durationSeconds)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link href={`/player?id=${story.id}`} className="block group">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-navy-card border border-white/5 transition-colors group-hover:border-gold/20 group-active:scale-[0.99]">
          {/* Emoji cover */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ backgroundColor: story.coverColor }}
          >
            {story.coverEmoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-semibold truncate">{title}</h3>
            <p className="text-white/40 text-xs mt-0.5 truncate">{description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/30 text-[10px]">
                {story.voice.avatarEmoji}{" "}
                {language === "he" ? story.voice.nameHe : story.voice.name}
              </span>
              <span className="text-white/20 text-[10px]">·</span>
              <span className="text-white/30 text-[10px]">
                {formatDuration(story.durationSeconds)}
              </span>
            </div>
          </div>

          {/* Play button */}
          <div className="w-8 h-8 rounded-full border border-gold/40 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/10 transition-colors">
            <span className="text-gold text-xs ml-0.5">▶</span>
          </div>
        </div>
      </Link>
    );
  }

  // compact (default)
  return (
    <Link href={`/player?id=${story.id}`} className="block group">
      <div
        className="relative w-36 rounded-2xl overflow-hidden shadow-card border border-white/5 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]"
        style={{ backgroundColor: story.coverColor }}
      >
        <div className="flex items-center justify-center h-28 text-5xl">
          {story.coverEmoji}
        </div>
        <div className="p-2.5 bg-gradient-to-t from-black/50 to-transparent">
          <h3 className="text-white text-xs font-semibold leading-tight line-clamp-2">
            {title}
          </h3>
          <p className="text-white/40 text-[10px] mt-0.5">
            {formatDuration(story.durationSeconds)}
          </p>
        </div>
      </div>
    </Link>
  );
}
