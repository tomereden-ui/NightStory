"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import { STORIES, formatDuration } from "@/lib/mockData";
import type { StoryCategory } from "@/types";

const CATEGORY_LABELS: Record<StoryCategory, { en: string; he: string }> = {
  adventure:    { en: "Adventure",  he: "הרפתקה"    },
  fantasy:      { en: "Fantasy",    he: "פנטזיה"    },
  animals:      { en: "Animals",    he: "חיות"      },
  bedtime:      { en: "Bedtime",    he: "לפני שינה" },
  friendship:   { en: "Friendship", he: "חברות"     },
  nature:       { en: "Nature",     he: "טבע"       },
  space:        { en: "Space",      he: "חלל"       },
  "fairy-tale": { en: "Fairy Tale", he: "אגדה"      },
};

const DURATION_COLORS = [
  "text-teal bg-teal/10 border-teal/20",
  "text-purple-bright bg-purple/10 border-purple/20",
  "text-pink bg-pink/10 border-pink/20",
];

export default function LibraryPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<StoryCategory | "all">("all");

  const filtered = STORIES.filter((story) => {
    const title = language === "he" && story.titleHe ? story.titleHe : story.title;
    const matchesSearch = title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || story.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Object.entries(CATEGORY_LABELS) as [StoryCategory, { en: string; he: string }][];

  return (
    <div className="relative min-h-full bg-bg">
      <StarField count={20} />

      {/* Header */}
      <div className="relative px-5 pt-12 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white tracking-tight">
            <span className="text-gradient-teal">NightStory</span>
          </h1>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-sm">
              🔔
            </button>
            <div className="w-8 h-8 rounded-full bg-bg-card border border-purple/20 flex items-center justify-center text-sm">
              🌙
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-bg-border">
          {(["my", "public"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 text-xs font-bold tracking-widest uppercase transition-colors relative ${
                activeTab === tab ? "text-white" : "text-white/25 hover:text-white/50"
              }`}
            >
              {tab === "my" ? (language === "he" ? "הסיפורים שלי" : "MY STORIES") : (language === "he" ? "ציבורי" : "PUBLIC")}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 py-3">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
            activeCategory === "all"
              ? "bg-white text-bg border-white"
              : "bg-transparent text-white/35 border-white/10 hover:border-white/25"
          }`}
        >
          All
        </button>
        {categories.map(([key, labels]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
              activeCategory === key
                ? "bg-white text-bg border-white"
                : "bg-transparent text-white/35 border-white/10 hover:border-white/25"
            }`}
          >
            {language === "he" ? labels.he : labels.en}
          </button>
        ))}
      </div>

      {/* Story list */}
      <div className="px-5 flex flex-col gap-1 pb-4">
        {filtered.map((story, i) => {
          const title = language === "he" && story.titleHe ? story.titleHe : story.title;
          const desc = language === "he" && story.descriptionHe ? story.descriptionHe : story.description;
          const durationColor = DURATION_COLORS[i % DURATION_COLORS.length];

          return (
            <Link
              key={story.id}
              href={`/player?id=${story.id}`}
              className="flex items-center gap-3 py-3 border-b border-white/4 hover:bg-white/2 transition-colors group"
            >
              {/* Circular thumbnail */}
              <div
                className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl border border-white/10 shadow-card overflow-hidden"
                style={{ background: story.coverGradient ?? story.coverColor }}
              >
                {story.coverEmoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate leading-tight">{title}</p>
                <p className="text-white/35 text-xs truncate mt-0.5 leading-tight">{desc}</p>
              </div>

              {/* Duration pill */}
              <div className={`flex-shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${durationColor}`}>
                {formatDuration(story.durationSeconds)}
              </div>
            </Link>
          );
        })}
      </div>

      {/* FAB */}
      <Link
        href="/create"
        className="fixed bottom-24 right-4 w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl font-light shadow-purple z-40"
        style={{ background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 20px rgba(139,92,246,0.5)" }}
      >
        +
      </Link>

      {/* Bottom nav spacer */}
      <div className="h-4" />
    </div>
  );
}
