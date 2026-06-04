"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { STORIES, formatDuration } from "@/lib/mockData";

const DURATION_COLORS = [
  "text-teal bg-teal/10 border-teal/20",
  "text-purple-bright bg-purple/10 border-purple/20",
  "text-pink bg-pink/10 border-pink/20",
];

export default function QuickPickSection() {
  const { t, language } = useLanguage();
  const picks = STORIES.slice(0, 4);

  return (
    <section className="px-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white/80 font-semibold text-sm tracking-wide">{t("forYou")}</h2>
        <Link href="/library" className="text-white/25 text-xs hover:text-white/50 transition-colors">
          {language === "he" ? "הכל →" : "See all →"}
        </Link>
      </div>

      <div className="flex flex-col">
        {picks.map((story, i) => {
          const title = language === "he" && story.titleHe ? story.titleHe : story.title;
          const desc = language === "he" && story.descriptionHe ? story.descriptionHe : story.description;
          const dColor = DURATION_COLORS[i % DURATION_COLORS.length];

          return (
            <Link key={story.id} href={`/player?id=${story.id}`}
              className="flex items-center gap-3 py-3 border-b border-white/4 hover:bg-white/2 transition-colors group">
              {/* Circular thumbnail */}
              <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl border border-white/8"
                style={{ background: story.coverGradient ?? story.coverColor }}>
                {story.coverEmoji}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate leading-tight">{title}</p>
                <p className="text-white/30 text-xs truncate mt-0.5">{desc}</p>
              </div>
              {/* Duration pill */}
              <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${dColor}`}>
                {formatDuration(story.durationSeconds)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
