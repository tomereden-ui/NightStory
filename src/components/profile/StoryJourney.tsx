"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";

// ── Mock data — replace with real Supabase queries once story_plays table exists ──

const MOCK_CHILDREN = [
  {
    id: "maya",
    name: "Maya",
    emoji: "🧒",
    streak: 14,
    storiesThisMonth: 12,
    totalMinutes: 84,
    topTheme: "Adventure",
    topThemeCount: 7,
    lessons: [
      { label: "Kindness", count: 4, color: "#f472b6" },
      { label: "Courage", count: 3, color: "#fbbf24" },
      { label: "Friendship", count: 2, color: "#4fc3f7" },
    ],
    recentTitles: ["The Dragon Who Was Afraid of Fire", "Peter Pan", "Maya and the Star Garden"],
    // last 28 days: 0 = no story, 1 = one story, 2 = two stories
    calendar: [1,0,2,1,0,1,1,2,0,0,1,1,2,0,1,1,1,2,0,1,2,0,1,1,1,2,1,1],
  },
  {
    id: "lior",
    name: "Lior",
    emoji: "👦",
    streak: 5,
    storiesThisMonth: 6,
    totalMinutes: 42,
    topTheme: "Space",
    topThemeCount: 4,
    lessons: [
      { label: "Courage", count: 3, color: "#fbbf24" },
      { label: "Curiosity", count: 2, color: "#a78bfa" },
    ],
    recentTitles: ["Space Rangers: Lost on Mars", "The Brave Little Robot"],
    calendar: [0,0,1,0,0,1,1,0,0,0,1,0,1,0,0,1,1,0,0,1,1,0,0,1,1,2,1,1],
  },
];

// Exported for the home screen snippet
export const MOCK_JOURNEY = MOCK_CHILDREN;

// ── Calendar heatmap ─────────────────────────────────────────────────────────

const CELL = 20; // px per cell
const GAP  = 4;  // px gap

function cellStyle(count: number): React.CSSProperties {
  if (count === 0) return { background: "rgba(255,255,255,0.06)" };
  if (count === 1) return {
    background: "linear-gradient(135deg, #4fc3f7, #a78bfa)",
    boxShadow: "0 0 5px rgba(79,195,247,0.35)",
  };
  return {
    background: "linear-gradient(135deg, #fbbf24, #f472b6)",
    boxShadow: "0 0 7px rgba(251,191,36,0.5)",
  };
}

function CalendarLegend() {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ width: CELL, height: CELL, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
        <span style={{ fontSize: "var(--fs-micro)", color: "rgba(255,255,255,0.2)" }}>{t("calNone" as TranslationKey)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ width: CELL, height: CELL, borderRadius: 3, background: "linear-gradient(135deg,#4fc3f7,#a78bfa)" }} />
        <span style={{ fontSize: "var(--fs-micro)", color: "rgba(255,255,255,0.2)" }}>{t("cal1Story" as TranslationKey)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ width: CELL, height: CELL, borderRadius: 3, background: "linear-gradient(135deg,#fbbf24,#f472b6)" }} />
        <span style={{ fontSize: "var(--fs-micro)", color: "rgba(255,255,255,0.2)" }}>{t("cal2Plus" as TranslationKey)}</span>
      </div>
    </div>
  );
}

function CalendarHeatmap({ days }: { days: number[] }) {
  const DAY_LABELS = ["S","M","T","W","T","F","S"];
  const totalW = 7 * CELL + 6 * GAP;
  return (
    <div style={{ width: totalW }}>
      {/* day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP, marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ width: CELL, textAlign: "center", fontSize: "var(--fs-micro)", fontWeight: 700, color: "rgba(255,255,255,0.2)" }}>{d}</div>
        ))}
      </div>
      {/* cells */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP }}>
        {days.map((count, i) => (
          <div
            key={i}
            title={count > 0 ? `${count} ${count === 1 ? "story" : "stories"}` : undefined}
            style={{ width: CELL, height: CELL, borderRadius: 3, ...cellStyle(count) }}
          />
        ))}
      </div>
      {/* legend */}
      <CalendarLegend />
    </div>
  );
}

// ── Single child journey card ─────────────────────────────────────────────────

function ChildJourneyCard({ child }: { child: typeof MOCK_CHILDREN[0] }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const hours = Math.floor(child.totalMinutes / 60);
  const mins  = child.totalMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  return (
    <div
      className="rounded-3xl overflow-hidden mb-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header — always visible, tap to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 pt-4 pb-3 flex items-center justify-between transition-colors"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-fs-title">{child.emoji}</span>
          <div className="text-left">
            <p className="text-white text-fs-body font-bold">{child.name}&apos;s {t("storyJourneyTitle" as TranslationKey).replace(" ✨", "")}</p>
            <p className="text-white/30 text-fs-body">{t(open ? ("thisMonthClose" as TranslationKey) : ("thisMonthExpand" as TranslationKey))}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Streak pill */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            <span className="text-fs-body">🌙</span>
            <span className="text-fs-body font-bold" style={{ color: "#fbbf24" }}>
              {child.streak}
            </span>
          </div>
          {/* Chevron */}
          <span
            className="text-white/25 text-fs-body transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}
          >
            ▾
          </span>
        </div>
      </button>

      {open && <div className="px-4 pt-3 pb-4 flex flex-col gap-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Stories", value: child.storiesThisMonth, color: "#4fc3f7" },
            { label: "Listened", value: timeLabel, color: "#a78bfa" },
            { label: child.topTheme, value: `${child.topThemeCount}×`, color: "#10b981" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl px-2 py-2.5 flex flex-col items-center gap-0.5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-fs-body font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-fs-body font-semibold tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Lessons */}
        <div>
          <p className="text-fs-body font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Values heard this month
          </p>
          <div className="flex flex-wrap gap-1.5">
            {child.lessons.map((l) => (
              <span
                key={l.label}
                className="text-fs-body font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: `${l.color}18`,
                  border: `1px solid ${l.color}44`,
                  color: l.color,
                }}
              >
                {l.label} · {l.count}×
              </span>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div>
          <p className="text-fs-body font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Bedtime ritual — last 28 nights
          </p>
          <CalendarHeatmap days={child.calendar} />
        </div>

        {/* Recent stories */}
        <div>
          <p className="text-fs-body font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Recent stories
          </p>
          <div className="flex flex-col gap-1">
            {child.recentTitles.map((title, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(79,195,247,0.5)" }} />
                <p className="text-white/50 text-fs-body truncate">{title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Share CTA */}
        <button
          className="w-full py-2.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: "rgba(255,255,255,0.4)",
          }}
          onClick={() => {}}
        >
          Share {child.name}&apos;s month with family 🌙
        </button>
      </div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StoryJourney() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-7">
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div>
          <p className="text-white/55 text-fs-body font-bold tracking-widest uppercase text-left">
            Story Journey ✨
          </p>
          <p className="text-white/25 text-fs-body mt-0.5 text-left">Monthly reflection for each child</p>
        </div>
        <span
          className="text-white/30 text-fs-body transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div>
          {/* Mock notice */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-3"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
          >
            <span className="text-fs-body">🚧</span>
            <p className="text-fs-body" style={{ color: "rgba(251,191,36,0.7)" }}>
              Preview — showing example data. Real tracking coming soon.
            </p>
          </div>

          {MOCK_CHILDREN.map((child) => (
            <ChildJourneyCard key={child.id} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
