"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { STORIES } from "@/lib/mockData";

function durationLabel(seconds: number) {
  return `${Math.floor(seconds / 60)} min`;
}

export default function QuickPickSection() {
  const { t, language } = useLanguage(); // language still used for story title/desc fallback
  const picks = STORIES.slice(0, 4);

  return (
    <section className="px-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white/80 font-semibold text-fs-body tracking-wide">{t("forYou")}</h2>
        <Link href="/library" className="text-white/25 text-fs-label">
          {t("seeAll")}
        </Link>
      </div>

      <div className="flex flex-col">
        {picks.map((story) => {
          const title = language === "he" && story.titleHe ? story.titleHe : story.title;
          const desc = language === "he" && story.descriptionHe ? story.descriptionHe : story.description;

          return (
            <Link
              key={story.id}
              href={`/player?id=${story.id}`}
              className="flex items-center gap-4 py-3.5 active:opacity-70 transition-opacity"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Rectangular thumbnail */}
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-fs-subtitle overflow-hidden"
                style={{ background: story.coverGradient ?? story.coverColor }}
              >
                {story.coverEmoji}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-fs-body font-semibold truncate leading-snug">{title}</p>
                <p className="text-white/30 text-fs-label truncate mt-0.5">{desc}</p>
              </div>
              {/* Duration pill — teal */}
              <span
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-fs-caption font-bold"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  color: "#00D4FF",
                  border: "1px solid rgba(0,212,255,0.18)",
                }}
              >
                {durationLabel(story.durationSeconds)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
