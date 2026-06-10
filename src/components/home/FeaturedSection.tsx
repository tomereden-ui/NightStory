"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { getFeaturedStories } from "@/lib/mockData";

function durationLabel(seconds: number) {
  return `${Math.floor(seconds / 60)} min`;
}

export default function FeaturedSection() {
  const { t, language } = useLanguage();
  const stories = getFeaturedStories();

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-white/80 font-semibold text-sm tracking-wide">{t("featuredStories")}</h2>
        <Link href="/library" className="text-white/25 text-xs">See all →</Link>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-2">
        {stories.map((story) => {
          const title = language === "he" && story.titleHe ? story.titleHe : story.title;
          const voiceName = language === "he" ? story.voice.nameHe : story.voice.name;

          return (
            <Link
              key={story.id}
              href={`/player?id=${story.id}`}
              className="flex-shrink-0 w-44 rounded-2xl overflow-hidden active:scale-[0.97] transition-transform"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Cover */}
              <div
                className="h-36 flex items-center justify-center text-6xl relative"
                style={{ background: story.coverGradient ?? story.coverColor }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), transparent 65%)" }}
                />
                <span className="relative drop-shadow-lg">{story.coverEmoji}</span>
              </div>
              {/* Info */}
              <div className="px-3 py-2.5" style={{ background: "rgba(10,12,20,0.9)" }}>
                <p className="text-white text-xs font-semibold leading-snug line-clamp-2 mb-1.5">{title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-white/35 text-[10px]">
                    {story.voice.avatarEmoji} {voiceName}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: "#00D4FF" }}>
                    {durationLabel(story.durationSeconds)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
