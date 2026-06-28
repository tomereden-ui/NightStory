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
  const description = language === "he" && story.descriptionHe ? story.descriptionHe : story.description;

  const coverStyle = {
    background: story.coverGradient ?? story.coverColor,
  };

  if (variant === "featured") {
    return (
      <Link href={`/player?id=${story.id}`} className="block group flex-shrink-0">
        <div
          className="relative w-44 h-56 rounded-3xl overflow-hidden shadow-card border border-white/5 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]"
          style={coverStyle}
        >
          {/* Glow orb */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/5 blur-xl" />
          </div>

          {/* Emoji */}
          <div className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-lg">
            {story.coverEmoji}
          </div>

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}>
            {story.isFavorite && <span className="text-pink text-fs-label">♥ </span>}
            <h3 className="text-white text-fs-label font-semibold leading-tight line-clamp-2">{title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-teal/70 text-fs-caption">{story.voice.avatarEmoji}</span>
              <span className="text-white/40 text-fs-caption">{formatDuration(story.durationSeconds)}</span>
            </div>
          </div>

          {/* Category badge */}
          <div className="absolute top-2.5 left-2.5">
            <span className="text-fs-micro font-medium uppercase tracking-wider bg-black/40 backdrop-blur-sm text-white/60 px-2 py-0.5 rounded-full border border-white/10">
              {story.category}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link href={`/player?id=${story.id}`} className="block group">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-bg-card border border-bg-border transition-all group-hover:border-purple/30 group-hover:shadow-purple-sm group-active:scale-[0.99]">
          {/* Cover */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-fs-display flex-shrink-0 border border-white/5"
            style={coverStyle}
          >
            {story.coverEmoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-fs-body font-semibold truncate">{title}</h3>
            <p className="text-white/35 text-fs-label mt-0.5 truncate">{description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-teal/60 text-fs-caption">
                {story.voice.avatarEmoji} {language === "he" ? story.voice.nameHe : story.voice.name}
              </span>
              <span className="text-white/20 text-fs-caption">·</span>
              <span className="text-white/30 text-fs-caption">{formatDuration(story.durationSeconds)}</span>
            </div>
          </div>

          {/* Play */}
          <div className="w-8 h-8 rounded-full border border-purple/40 flex items-center justify-center flex-shrink-0 group-hover:bg-purple/15 group-hover:border-purple/70 transition-all">
            <span className="text-purple-bright text-fs-label ml-0.5">▶</span>
          </div>
        </div>
      </Link>
    );
  }

  // compact
  return (
    <Link href={`/player?id=${story.id}`} className="block group flex-shrink-0">
      <div
        className="relative w-36 h-44 rounded-2xl overflow-hidden shadow-card border border-white/5 transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]"
        style={coverStyle}
      >
        <div className="absolute inset-0 flex items-center justify-center text-5xl drop-shadow-lg">
          {story.coverEmoji}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2.5" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}>
          <h3 className="text-white text-fs-label font-semibold leading-tight line-clamp-2">{title}</h3>
          <p className="text-white/40 text-fs-caption mt-0.5">{formatDuration(story.durationSeconds)}</p>
        </div>
      </div>
    </Link>
  );
}
