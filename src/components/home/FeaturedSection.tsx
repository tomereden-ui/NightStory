"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { getFeaturedStories, formatDuration } from "@/lib/mockData";

export default function FeaturedSection() {
  const { t, language } = useLanguage();
  const stories = getFeaturedStories();

  return (
    <section className="mb-2">
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-white/80 font-semibold text-sm tracking-wide">{t("featuredStories")}</h2>
        <Link href="/library" className="text-white/25 text-xs hover:text-white/50 transition-colors">See all →</Link>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-1">
        {stories.map((story) => {
          const title = language === "he" && story.titleHe ? story.titleHe : story.title;
          return (
            <Link key={story.id} href={`/player?id=${story.id}`} className="flex-shrink-0 group">
              <div className="w-40 rounded-2xl overflow-hidden border border-white/5 transition-transform group-hover:scale-[1.02] group-active:scale-[0.98]"
                style={{ background: story.coverGradient ?? story.coverColor }}>
                {/* Cover art area */}
                <div className="h-36 flex items-center justify-center text-6xl relative">
                  <div className="absolute inset-0 opacity-20"
                    style={{ background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.15), transparent 70%)" }} />
                  <span className="relative drop-shadow-lg">{story.coverEmoji}</span>
                </div>
                {/* Info */}
                <div className="p-2.5" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/35 text-[10px]">{story.voice.avatarEmoji} {language === "he" ? story.voice.nameHe : story.voice.name}</span>
                    <span className="text-teal/60 text-[10px]">{formatDuration(story.durationSeconds)}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
