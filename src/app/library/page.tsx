"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import type { LibraryEntry } from "@/lib/libraryStore";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export default function LibraryPage() {
  const { language } = useLanguage();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="cosmic-page min-h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div className="w-9" />
          <h1
            className="text-lg font-light tracking-widest"
            style={{
              background: "linear-gradient(135deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 12px rgba(79,195,247,0.3))",
            }}
          >
            {language === "he" ? "הסיפורים שלי" : "NightStory"}
          </h1>
          <div className="w-9" />
        </div>
        <p
          className="text-center text-xs tracking-widest uppercase mb-6"
          style={{ color: "rgba(79,195,247,0.6)", letterSpacing: "0.25em" }}
        >
          {language === "he" ? "הספרייה שלי" : "My Stories"}
        </p>
      </div>

      <div className="px-4 pb-32">
        {loading ? (
          <div className="flex justify-center pt-24">
            <span className="text-white/30 text-sm animate-pulse">Loading…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
            <span className="text-5xl" style={{ filter: "drop-shadow(0 0 20px rgba(79,195,247,0.4))" }}>🌙</span>
            <p className="text-white/40 text-sm font-light tracking-wide">
              {language === "he" ? "עדיין אין סיפורים" : "No stories yet"}
            </p>
            <p className="text-white/20 text-xs">
              {language === "he" ? "צור סיפור ראשון כדי להתחיל" : "Create your first story to get started"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/library/${entry.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl active:opacity-70 transition-opacity"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Cover thumbnail */}
                <div
                  className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl"
                  style={{
                    background: entry.coverUrl
                      ? undefined
                      : "radial-gradient(ellipse at 40% 40%, rgba(26,58,110,0.8), rgba(45,27,78,0.8))",
                    border: "1px solid rgba(79,195,247,0.15)",
                    boxShadow: "0 0 12px rgba(79,195,247,0.08)",
                  }}
                >
                  {entry.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ filter: "drop-shadow(0 0 8px rgba(79,195,247,0.5))" }}>🌙</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate leading-snug tracking-wide">
                    {entry.title}
                  </p>
                  <p className="text-white/38 text-xs truncate mt-0.5 leading-snug">
                    {entry.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-[9px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(79,195,247,0.1)",
                        border: "1px solid rgba(79,195,247,0.25)",
                        color: "#4fc3f7",
                      }}
                    >
                      {durationLabel(entry.durationSeconds)}
                    </span>
                    <span className="text-white/20 text-[10px]">{timeAgo(entry.createdAt)}</span>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-white/18 text-base flex-shrink-0" style={{ color: "rgba(79,195,247,0.3)" }}>›</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link
        href="/create"
        className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-light z-40 active:scale-95 transition-transform"
        style={{
          background: "linear-gradient(135deg, rgba(79,195,247,0.3), rgba(79,195,247,0.12))",
          border: "1px solid rgba(79,195,247,0.4)",
          boxShadow: "0 4px 24px rgba(79,195,247,0.25)",
          backdropFilter: "blur(12px)",
        }}
      >
        ✦
      </Link>
    </div>
  );
}
