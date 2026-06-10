"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { STORIES } from "@/lib/mockData";

function durationLabel(seconds: number) {
  return `${Math.floor(seconds / 60)} MIN READ`;
}

export default function LibraryPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");

  const stories = STORIES;

  return (
    <div className="min-h-full" style={{ background: "#0A0C14" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-0">
        <div className="flex items-center justify-between mb-5">
          <button className="w-9 h-9 flex items-center justify-center text-white/50 text-lg">
            ☰
          </button>
          <h1 className="text-base font-semibold text-white tracking-wide">NightStory</h1>
          <button className="w-9 h-9 flex items-center justify-center text-white/40 text-base">
            ⚙
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {(["my", "public"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 text-[11px] font-bold tracking-widest uppercase transition-colors relative ${
                activeTab === tab ? "text-white" : "text-white/25"
              }`}
            >
              {tab === "my" ? (language === "he" ? "הסיפורים שלי" : "MY STORIES") : (language === "he" ? "ציבורי" : "PUBLIC")}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#00D4FF" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Story list */}
      <div className="px-5 pb-4 mt-1">
        {stories.map((story) => {
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
                className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl overflow-hidden"
                style={{ background: story.coverGradient ?? story.coverColor }}
              >
                {story.coverEmoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate leading-snug">{title}</p>
                <p className="text-white/35 text-xs truncate mt-0.5 leading-snug">{desc}</p>
              </div>

              {/* Duration pill */}
              <div
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  color: "#00D4FF",
                  border: "1px solid rgba(0,212,255,0.18)",
                }}
              >
                {durationLabel(story.durationSeconds)}
              </div>
            </Link>
          );
        })}
      </div>

      {/* FAB */}
      <Link
        href="/create"
        className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-light z-40 active:scale-95 transition-transform"
        style={{
          background: "linear-gradient(135deg,#00D4FF,#00A8C8)",
          boxShadow: "0 4px 20px rgba(0,212,255,0.35)",
        }}
      >
        +
      </Link>
    </div>
  );
}
