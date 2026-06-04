"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StoryCard from "@/components/ui/StoryCard";
import StarField from "@/components/ui/StarField";
import { STORIES } from "@/lib/mockData";
import type { StoryCategory } from "@/types";

const CATEGORY_LABELS: Record<StoryCategory, { en: string; he: string; emoji: string }> =
  {
    adventure: { en: "Adventure", he: "הרפתקה", emoji: "🗺️" },
    fantasy: { en: "Fantasy", he: "פנטזיה", emoji: "🧙" },
    animals: { en: "Animals", he: "חיות", emoji: "🐾" },
    bedtime: { en: "Bedtime", he: "לפני שינה", emoji: "🌙" },
    friendship: { en: "Friendship", he: "חברות", emoji: "🤝" },
    nature: { en: "Nature", he: "טבע", emoji: "🌿" },
    space: { en: "Space", he: "חלל", emoji: "🚀" },
    "fairy-tale": { en: "Fairy Tale", he: "אגדה", emoji: "🏰" },
  };

export default function LibraryPage() {
  const { t, language, isRTL } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<StoryCategory | "all">("all");

  const categories = Object.entries(CATEGORY_LABELS) as [
    StoryCategory,
    { en: string; he: string; emoji: string }
  ][];

  const filtered = STORIES.filter((story) => {
    const title = language === "he" && story.titleHe ? story.titleHe : story.title;
    const matchesSearch = title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || story.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative min-h-full">
      <StarField count={30} />

      {/* Header */}
      <div className="relative px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-1">{t("library")}</h1>
        <p className="text-white/40 text-sm">
          {filtered.length} {language === "he" ? "סיפורים" : "stories"}
        </p>

        {/* Search */}
        <div className="relative mt-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">
            🔍
          </span>
          <input
            type="search"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir={isRTL ? "rtl" : "ltr"}
            className="w-full bg-navy-lighter border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-gold/40 transition-colors"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 pb-4">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeCategory === "all"
              ? "bg-gold text-navy"
              : "bg-navy-lighter text-white/50 border border-white/10"
          }`}
        >
          {language === "he" ? "הכל" : "All"}
        </button>
        {categories.map(([key, labels]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeCategory === key
                ? "bg-gold text-navy"
                : "bg-navy-lighter text-white/50 border border-white/10"
            }`}
          >
            <span>{labels.emoji}</span>
            {language === "he" ? labels.he : labels.en}
          </button>
        ))}
      </div>

      {/* Story grid */}
      <div className="relative px-5 pb-4">
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filtered.map((story) => (
              <StoryCard key={story.id} story={story} variant="list" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-white/50 text-sm">
              {language === "he" ? "לא נמצאו סיפורים" : "No stories found"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
