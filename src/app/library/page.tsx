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
    <div className="min-h-full" style={{ background: "#0A0C14" }}>
      <div className="px-5 pt-12 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div className="w-9" />
          <h1 className="text-base font-semibold text-white tracking-wide">
            {language === "he" ? "הסיפורים שלי" : "My Stories"}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="px-5 pb-32">
        {loading ? (
          <div className="flex justify-center pt-24">
            <span className="text-white/30 text-sm animate-pulse">Loading…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
            <span className="text-5xl">🌙</span>
            <p className="text-white/40 text-sm font-medium">
              {language === "he" ? "עדיין אין סיפורים" : "No stories yet"}
            </p>
            <p className="text-white/20 text-xs">
              {language === "he" ? "צור סיפור ראשון כדי להתחיל" : "Create your first story to get started"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/library/${entry.id}`}
                className="flex items-center gap-4 py-4 active:opacity-60 transition-opacity"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-xl"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.15)",
                  }}
                >
                  {entry.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover" />
                  ) : (
                    "🎙️"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate leading-snug">
                    {entry.title}
                  </p>
                  <p className="text-white/35 text-xs truncate mt-0.5 leading-snug">
                    {entry.summary}
                  </p>
                  <p className="text-white/20 text-[10px] mt-1">
                    {timeAgo(entry.createdAt)}
                  </p>
                </div>
                <span className="text-white/20 text-lg flex-shrink-0">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>

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
