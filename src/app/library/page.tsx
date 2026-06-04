"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StoryCard from "@/components/ui/StoryCard";
import StarField from "@/components/ui/StarField";
import { STORIES } from "@/lib/mockData";
import type { StoryCategory } from "@/types";

const CATEGORY_LABELS: Record<StoryCategory, { en: string; he: string; emoji: string }> = {
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
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");

  const categories = Object.entries(CATEGORY_LABELS) as [StoryCategory, { en: string; he: string; emoji: string }][];

  const filtered = STORIES.filter((story) => {
    const title = language === "he" && story.titleHe ? story.titleHe : story.title;
    const matchesSearch = title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || story.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative min-h-full">
      <StarField count={25} />

      {/* Header */}
      <div className="relative px-5 pt-12 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            <span className="text-gradient-teal">NightStory</span>
          </h1>
          <div className="w-8 h-8 rounded-full bg-bg-elevated border border-purple/20 flex items-center justify-center text-base">
            🌙
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-white/5 mb-4">
          <button
            onClick={() => setActiveTab("my")}
            className={`pb-2.5 text-sm font-medium transition-colors ${activeTab === "my" ? "tab-active" : "tab-inactive"}`}
          >
            {language === "he" ? "הסיפורים שלי" : "MY STORIES"}
          </button>
          <button
            onClick={() => setActiveTab("public")}
            className={`pb-2.5 text-sm font-medium transition-colors ${activeTab === "public" ? "tab-active" : "tab-inactive"}`}
          >
            {language === "he" ? "ציבורי" : "PUBLIC"}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">🔍</span>
          <input
            type="search"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir={isRTL ? "rtl" : "ltr"}
            className="w-full bg-bg-card border border-bg-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/20 outline-none focus:border-purple/40 transition-colors"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 pb-3">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
            activeCategory === "all"
              ? "bg-purple text-white border-purple"
              : "bg-bg-card text-white/40 border-bg-border"
          }`}
        >
          {language === "he" ? "הכל" : "All"}
        </button>
        {categories.map(([key, labels]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              activeCategory === key
                ? "bg-purple text-white border-purple"
                : "bg-bg-card text-white/40 border-bg-border"
            }`}
          >
            <span>{labels.emoji}</span>
            {language === "he" ? labels.he : labels.en}
          </button>
        ))}
      </div>

      {/* Story list */}
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
            <p className="text-white/30 text-sm">
              {language === "he" ? "לא נמצאו סיפורים" : "No stories found"}
            </p>
          </div>
        )}
      </div>

      {/* FAB */}
      <a
        href="/create"
        className="fixed bottom-24 right-4 w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-purple z-40"
        style={{ background: "linear-gradient(135deg, #8B5CF6, #EC4899)" }}
      >
        +
      </a>
    </div>
  );
}
