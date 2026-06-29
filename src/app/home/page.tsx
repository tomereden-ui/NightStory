"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useViewMode } from "@/context/ViewModeContext";
import { useLanguage } from "@/context/LanguageContext";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { ClassicMeta } from "@/lib/classicStories";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import { MOCK_JOURNEY } from "@/components/profile/StoryJourney";

// ── helpers ───────────────────────────────────────────────────────────────────

const CARD_PALETTES: [string, string][] = [
  ["#4fc3f7", "#7c3aed"],
  ["#f59e0b", "#ec4899"],
  ["#10b981", "#4fc3f7"],
  ["#a78bfa", "#f472b6"],
  ["#38bdf8", "#818cf8"],
  ["#fb923c", "#e879f9"],
];

function cardPalette(title: string): [string, string] {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return CARD_PALETTES[h % CARD_PALETTES.length];
}

function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m <= 1 ? "1 min" : `${m} min`;
}

function greeting(hour: number, tFn: (key: string) => string): string {
  if (hour < 5) return tFn("sweetDreams");
  if (hour < 12) return tFn("goodMorning");
  if (hour < 17) return tFn("goodAfternoon");
  if (hour < 21) return tFn("goodEvening");
  return tFn("goodNightGreeting");
}

// ── Story card (portrait, Netflix/HBO style) ──────────────────────────────────

function StoryCard({
  title,
  coverUrl,
  durationSeconds,
  href,
  showDuration = false,
  progressPercent,
}: {
  title: string;
  summary?: string;
  coverUrl?: string | null;
  durationSeconds: number;
  href: string;
  showDuration?: boolean;
  progressPercent?: number;
}) {
  const [c1, c2] = cardPalette(title);
  return (
    <Link
      href={href}
      className="flex-shrink-0 rounded-2xl overflow-hidden transition-all active:scale-[0.97] select-none relative"
      style={{
        width: 130,
        height: 195,
        boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Full-bleed image */}
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-5xl"
          style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}66)` }}
        >
          <span style={{ filter: `drop-shadow(0 0 16px ${c1}aa)` }}>🌙</span>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(4,6,18,0.98) 100%)" }}
      />

      {/* Duration badge — top right (Continue Listening only) */}
      {showDuration && (
        <span
          className="absolute top-2 right-2 text-fs-body font-bold tracking-widest px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(4,6,18,0.72)",
            backdropFilter: "blur(6px)",
            color: c1,
            border: `1px solid ${c1}55`,
          }}
        >
          {durationLabel(durationSeconds)}
        </span>
      )}

      {/* Title — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-6">
        <p className="text-white text-fs-body font-bold leading-tight line-clamp-2 tracking-wide">{title}</p>
      </div>

      {/* Progress bar — bottom edge (Continue Listening) */}
      {progressPercent !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "rgba(255,255,255,0.12)" }}>
          <div
            className="h-full"
            style={{
              width: `${Math.max(4, Math.min(100, progressPercent))}%`,
              background: `linear-gradient(90deg, ${c1}, ${c2})`,
              borderRadius: "0 2px 2px 0",
            }}
          />
        </div>
      )}
    </Link>
  );
}

// ── Hero banner (Netflix-style featured story) ────────────────────────────────

function HeroBanner({ story, progressPercent = 42, tFn }: { story: LibraryEntry; progressPercent?: number; tFn: (key: string) => string }) {
  const [c1, c2] = cardPalette(story.title);
  const remaining = story.durationSeconds > 0
    ? durationLabel(Math.round(story.durationSeconds * (1 - progressPercent / 100)))
    : null;

  return (
    <div
      className="relative overflow-hidden mx-5 mb-6 rounded-3xl select-none"
      style={{
        height: 260,
        boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 64px ${c1}18`,
        border: `1px solid ${c1}22`,
      }}
    >
      {/* Cover art */}
      {story.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.coverUrl}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.75)" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: `linear-gradient(145deg, ${c1}44, ${c2}88)` }}
        >
          <span style={{ fontSize: 80, filter: `drop-shadow(0 0 32px ${c1}aa)` }}>🌙</span>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,6,18,0.97) 0%, rgba(4,6,18,0.3) 55%, transparent 100%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(4,6,18,0.6) 0%, transparent 60%)" }} />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
        {/* Label */}
        <span
          className="inline-block text-fs-body font-bold tracking-widest uppercase mb-2 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(79,195,247,0.18)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }}
        >
          {tFn("continueListening")}
        </span>

        {/* Title */}
        <h2
          className="text-white font-bold leading-tight mb-3 line-clamp-2"
          style={{ fontSize: "var(--fs-title)", letterSpacing: "-0.01em" }}
        >
          {story.title}
        </h2>

        {/* Progress bar */}
        <div className="rounded-full overflow-hidden mb-3" style={{ height: 3, background: "rgba(255,255,255,0.18)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${c1}, ${c2})`,
              boxShadow: `0 0 8px ${c1}88`,
            }}
          />
        </div>

        {/* CTA row */}
        <div className="flex items-center gap-3">
          <Link
            href={`/library/${story.id}`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              color: "#fff",
              fontSize: "var(--fs-body)",
              boxShadow: `0 4px 16px ${c1}55`,
            }}
          >
            {tFn("continueButton")}
          </Link>
          {remaining && (
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
              {remaining} {tFn("timeLeft")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Horizontal rail ───────────────────────────────────────────────────────────

function Rail({
  title,
  action,
  children,
  empty,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasChildren = !!children && (Array.isArray(children) ? children.length > 0 : true);

  return (
    <section className="mb-8">
      {/* Rail header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-fs-body font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-fs-body font-semibold tracking-wider uppercase transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            {action.label} →
          </Link>
        )}
      </div>

      {hasChildren ? (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-5 pb-1"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      ) : (
        <div className="px-5">{empty}</div>
      )}
    </section>
  );
}

// ── Skeleton rail ─────────────────────────────────────────────────────────────

function SkeletonRail() {
  return (
    <div className="flex gap-3 px-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex-shrink-0 rounded-2xl animate-pulse"
          style={{ width: 140, height: 164, background: "rgba(255,255,255,0.04)", animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

// ── Tonight's Picks rail ──────────────────────────────────────────────────────

type PickItem = {
  title: string;
  summary: string;
  coverUrl?: string | null;
  durationSeconds: number;
  href: string;
  tag: "Your Story" | "Classic";
  emoji?: string;
};

function TonightsPickCard({ item }: { item: PickItem }) {
  const [c1, c2] = cardPalette(item.title);
  const isOwn = item.tag === "Your Story";

  return (
    <Link
      href={item.href}
      className="flex-shrink-0 rounded-3xl overflow-hidden transition-all active:scale-[0.97] select-none relative"
      style={{
        width: 200,
        height: 290,
        boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 32px ${c1}18`,
        border: `1px solid ${c1}28`,
      }}
    >
      {/* Full-bleed image */}
      {item.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.coverUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-6xl"
          style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}66)` }}
        >
          <span style={{ filter: `drop-shadow(0 0 20px ${c1}aa)` }}>
            {item.emoji ?? "🌙"}
          </span>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, transparent 38%, rgba(4,6,18,0.96) 100%)" }}
      />

      {/* Type tag — top left (Classics only) */}
      {!isOwn && (
        <span
          className="absolute top-3 left-3 text-fs-body font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(251,191,36,0.22)",
            border: "1px solid rgba(251,191,36,0.45)",
            color: "#fbbf24",
            backdropFilter: "blur(8px)",
          }}
        >
          {item.tag}
        </span>
      )}

      {/* Title + accent — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-4 pt-8">
        <div className="w-7 h-[2px] rounded-full mb-2" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
        <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{item.title}</p>
      </div>
    </Link>
  );
}

function TonightsPicksRail({ picks, tFn }: { picks: PickItem[]; tFn: (key: string) => string }) {
  if (picks.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-fs-body font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
          {tFn("tonightsPicks")}
        </h2>
      </div>
      <div
        className="flex gap-3 overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {picks.map((item, i) => (
          <TonightsPickCard key={i} item={item} />
        ))}
      </div>
    </section>
  );
}

// ── Child profile selector (HBO Max style) ───────────────────────────────────

function ChildPill({
  child,
  active,
  onClick,
}: {
  child: DBChildProfile;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2 transition-all active:scale-95"
      style={{ width: 72 }}
    >
      {/* Avatar with selection ring */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          padding: 3,
          background: active
            ? "linear-gradient(135deg, #4fc3f7, #a78bfa)"
            : "transparent",
          boxShadow: active
            ? "0 0 20px rgba(79,195,247,0.45), 0 0 40px rgba(167,139,250,0.2)"
            : "none",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: "rgba(255,255,255,0.06)",
            border: active ? "2px solid #080c18" : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {child.avatar_emoji?.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={child.avatar_emoji}
              alt={child.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "var(--fs-display)", lineHeight: 1 }}>{child.avatar_emoji || "🧒"}</span>
          )}
        </div>
      </div>
      {/* Name */}
      <span
        className="text-fs-body font-semibold tracking-wide truncate w-full text-center"
        style={{
          color: active ? "#fff" : "rgba(255,255,255,0.45)",
          transition: "color 0.2s ease",
        }}
      >
        {child.name}
      </span>
    </button>
  );
}

// ── Shared-with-me empty state ─────────────────────────────────────────────────

function SharedEmptyState() {
  return (
    <div
      className="rounded-2xl px-5 py-6 flex flex-col items-center gap-3 text-center"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px dashed rgba(255,255,255,0.1)",
      }}
    >
      <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 12px rgba(167,139,250,0.5))" }}>💌</span>
      <div>
        <p className="text-white/50 text-fs-body font-medium">No stories shared yet</p>
        <p className="text-white/25 text-fs-body mt-1">Stories your family shares will appear here</p>
      </div>
    </div>
  );
}

// ── Create CTA ────────────────────────────────────────────────────────────────

const CTA_SUBTITLES = [
  "What world should Maya visit tonight?",
  "A new adventure in 2 minutes →",
  "Every night a different story ✨",
  "What happens in tonight's dream?",
  "Your story, your characters, right now →",
];

function CreateCTA({ childName }: { childName?: string }) {
  const [subtitleIdx] = useState(() => Math.floor(Math.random() * CTA_SUBTITLES.length));
  const subtitle = CTA_SUBTITLES[subtitleIdx].replace("Maya", childName ?? "tonight");

  return (
    <div className="px-5 mb-10">
      <Link
        href="/studio2?start=prompt"
        className="flex items-center justify-between rounded-3xl px-5 py-4 transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, rgba(192,132,252,0.18) 0%, rgba(79,195,247,0.12) 100%)",
          border: "1px solid rgba(192,132,252,0.3)",
          boxShadow: "0 4px 32px rgba(192,132,252,0.15)",
        }}
      >
        <div>
          <p className="text-white font-bold text-fs-heading tracking-wide">Create a Story ✦</p>
          <p className="text-white/40 text-fs-body mt-0.5">{subtitle}</p>
        </div>
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-fs-heading flex-shrink-0"
          style={{
            background: "rgba(192,132,252,0.2)",
            border: "1px solid rgba(192,132,252,0.4)",
            color: "#c084fc",
          }}
        >
          ✦
        </span>
      </Link>
    </div>
  );
}

// ── Journey snapshot strip ────────────────────────────────────────────────────

const MINI_CELL = 8;
const MINI_GAP  = 2;

function JourneySnippet({ childName }: { childName?: string }) {
  const data = MOCK_JOURNEY.find((c) => c.name === childName) ?? MOCK_JOURNEY[0];
  if (!data) return null;
  const last7 = data.calendar.slice(-7);
  const hours = Math.floor(data.totalMinutes / 60);
  const mins  = data.totalMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return (
    <Link
      href="/profile#story-journey"
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl mt-3 transition-all active:scale-[0.98]"
      style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.14)" }}
    >
      {/* streak */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span style={{ fontSize: "var(--fs-label)" }}>🌙</span>
        <span className="text-fs-body font-bold" style={{ color: "#fbbf24" }}>{data.streak} nights</span>
      </div>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
      {/* stats */}
      <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>
        {data.storiesThisMonth} stories · {timeLabel} this month
      </span>
      {/* spacer */}
      <div style={{ flex: 1 }} />
      {/* mini 7-day heatmap */}
      <div style={{ display: "flex", gap: MINI_GAP, flexShrink: 0 }}>
        {last7.map((count, i) => (
          <div
            key={i}
            style={{
              width: MINI_CELL,
              height: MINI_CELL,
              borderRadius: 2,
              background: count === 0
                ? "rgba(255,255,255,0.07)"
                : count === 1
                  ? "linear-gradient(135deg,#4fc3f7,#a78bfa)"
                  : "linear-gradient(135deg,#fbbf24,#f472b6)",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.2)" }}>›</span>
    </Link>
  );
}

// ── Main Home page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const { effective } = useViewMode();
  const { t } = useLanguage();
  const isMobile = effective === "mobile";

  const [stories, setStories] = useState<LibraryEntry[]>([]);
  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [children, setChildren] = useState<DBChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hour, setHour] = useState(20);

  // Load children + classics once on mount
  useEffect(() => {
    setHour(new Date().getHours());
    Promise.all([
      fetch("/api/classics", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/child-profiles", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([cls, kids]) => {
        setClassics(Array.isArray(cls) ? cls : []);
        const kidList: DBChildProfile[] = Array.isArray(kids) ? kids : [];
        setChildren(kidList);
        const savedId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
        const firstId = savedId && kidList.find((k) => k.id === savedId) ? savedId : kidList[0]?.id ?? null;
        setActiveChildId(firstId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch stories whenever the active child changes
  useEffect(() => {
    if (activeChildId === null) return;
    fetch(`/api/library?childId=${encodeURIComponent(activeChildId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((lib) => setStories(Array.isArray(lib) ? lib : []))
      .catch(() => {});
  }, [activeChildId]);

  // Persist active child selection across sessions
  const handleChildSwitch = (id: string) => {
    setActiveChildId(id);
    localStorage.setItem("ns-active-child-id", id);
  };

  const activeChild = children.find((c) => c.id === activeChildId) ?? null;

  // "Tonight's Picks" — up to 2 user stories + up to 3 ready classics, interleaved
  const readyClassics = classics.filter((c) => c.status === "ready");
  const tonightsPicks: PickItem[] = [
    ...stories.slice(0, 2).map((s) => ({
      title: s.title,
      summary: s.summary ?? "",
      coverUrl: s.coverUrl,
      durationSeconds: s.durationSeconds,
      href: `/library/${s.id}`,
      tag: "Your Story" as const,
    })),
    ...readyClassics.slice(0, 3).map((c) => ({
      title: c.title,
      summary: c.tagline,
      coverUrl: c.coverUrl,
      durationSeconds: c.durationSeconds ?? 0,
      href: `/library/classics/${c.id}`,
      tag: "Classic" as const,
      emoji: c.emoji,
    })),
  ];

  // Recent stories (last 6)
  const recentStories = stories.slice(0, 6);

  // "Continue" — last 3 stories (simulate resume; no real progress tracking yet)
  const continueStories = stories.slice(0, 3);

  const greetingText = greeting(hour, t);
  const greetingName = activeChild ? `, ${activeChild.name}` : "";

  return (
    <div className="cosmic-page min-h-full">
      {/* ── Header ── */}
      <style>{`
        @keyframes owl-float {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-8px) rotate(2deg); }
        }
      `}</style>
      <div className="px-5 pt-12 pb-6">
        {/* Greeting */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h1
              className="text-fs-title font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #fff 0%, #4fc3f7 50%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {greetingText}{greetingName} 🌙
            </h1>
            <p className="text-white/30 text-fs-body mt-1 tracking-wide">
              {stories.length > 0
                ? `${stories.length} ${stories.length === 1 ? "story" : "stories"} ${t("inYourLibrary")}`
                : t("readyToCreate")}
            </p>
          </div>

          {/* Owl avatar */}
          <div
            className="flex-shrink-0 ml-3"
            style={{ animation: "owl-float 4s ease-in-out infinite" }}
          >
            <Image
              src="/owl-avatar.png"
              alt="NightStory owl"
              width={72}
              height={72}
              priority
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Child switcher — HBO Max style */}
        {children.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-1 pt-1" style={{ scrollbarWidth: "none" }}>
            {children.map((child) => (
              <ChildPill
                key={child.id}
                child={child}
                active={child.id === activeChildId}
                onClick={() => handleChildSwitch(child.id)}
              />
            ))}
          </div>
        )}

        {/* Journey snapshot — streak + 7-day mini heatmap */}
        <JourneySnippet childName={activeChild?.name} />
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div
                className="mx-5 h-4 rounded-full mb-4 animate-pulse"
                style={{ width: 100, background: "rgba(255,255,255,0.07)", animationDelay: `${i * 0.1}s` }}
              />
              <SkeletonRail />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Create CTA — prominent at top when no stories yet */}
          {stories.length === 0 && (
            <div className="px-5 mb-8">
              <Link
                href="/studio2?start=prompt"
                className="block rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, rgba(192,132,252,0.15) 0%, rgba(79,195,247,0.1) 100%)",
                  border: "1px solid rgba(192,132,252,0.3)",
                  padding: "40px 32px",
                  textAlign: "center",
                }}
              >
                <p className="text-5xl mb-4" style={{ filter: "drop-shadow(0 0 20px rgba(192,132,252,0.6))" }}>✨</p>
                <p className="text-white font-bold text-fs-heading">Create your first story</p>
                <p className="text-white/40 text-fs-body mt-2">{t("magicalAdventure")}</p>
              </Link>
            </div>
          )}

          {/* ── Hero banner — featured Continue Listening story ── */}
          {continueStories.length > 0 && (
            <HeroBanner story={continueStories[0]} progressPercent={42} tFn={t} />
          )}

          {/* ── Tonight's Picks ── */}
          <TonightsPicksRail picks={tonightsPicks} tFn={t} />

          {/* ── Continue Listening rail (all in-progress stories) ── */}
          {continueStories.length > 0 && (
            <Rail
              title={t("continueListening")}
              action={{ label: t("allClassics"), href: "/library" }}
            >
              {continueStories.map((s, idx) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  durationSeconds={s.durationSeconds}
                  href={`/library/${s.id}`}
                  showDuration
                  progressPercent={[42, 68, 23][idx] ?? 30}
                />
              ))}
            </Rail>
          )}

          {/* ── Your Stories ── */}
          {recentStories.length > 0 && (
            <Rail
              title={t("yourStories")}
              action={{ label: t("viewAll"), href: "/library" }}
            >
              {recentStories.map((s) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  durationSeconds={s.durationSeconds}
                  href={`/library/${s.id}`}
                />
              ))}
            </Rail>
          )}

          {/* ── Shared with Me ── */}
          <Rail
            title={t("sharedWithMe")}
            empty={<SharedEmptyState />}
          >
            {null}
          </Rail>

          {/* ── Classics ── */}
          {classics.length > 0 && (
            <Rail
              title={t("classicsSection")}
              action={{ label: t("allClassics"), href: "/library" }}
            >
              {classics.slice(0, 8).map((c) => (
                <StoryCard
                  key={c.id}
                  title={c.title}
                  summary={"tagline" in c ? (c as ClassicMeta).tagline : ""}
                  coverUrl={c.coverUrl}
                  durationSeconds={c.durationSeconds ?? 0}
                  href={`/library/classics/${c.id}`}
                />
              ))}
            </Rail>
          )}

          {/* ── Create CTA (bottom) ── */}
          {stories.length > 0 && <CreateCTA childName={activeChild?.name} />}
        </>
      )}

      {/* Desktop grid override: two-column layout for rails */}
      {!isMobile && (
        <style>{`
          @media (min-width: 672px) {
            .home-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          }
        `}</style>
      )}
    </div>
  );
}
