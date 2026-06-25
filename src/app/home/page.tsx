"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useViewMode } from "@/context/ViewModeContext";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { ClassicMeta } from "@/lib/classicStories";
import type { DBChildProfile } from "@/app/api/child-profiles/route";

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

function greeting(hour: number): string {
  if (hour < 5) return "Sweet dreams";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

// ── Story card (portrait, for horizontal rails) ───────────────────────────────

function StoryCard({
  title,
  summary,
  coverUrl,
  durationSeconds,
  href,
}: {
  title: string;
  summary?: string;
  coverUrl?: string | null;
  durationSeconds: number;
  href: string;
}) {
  const [c1, c2] = cardPalette(title);
  return (
    <Link
      href={href}
      className="flex-shrink-0 rounded-2xl overflow-hidden transition-all active:scale-[0.97] select-none"
      style={{
        width: 140,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ height: 100 }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-3xl"
            style={{ background: `linear-gradient(145deg, ${c1}22, ${c2}44)` }}
          >
            <span style={{ filter: `drop-shadow(0 0 10px ${c1}99)` }}>🌙</span>
          </div>
        )}
        {/* Duration badge */}
        <span
          className="absolute bottom-1.5 right-1.5 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(5,8,20,0.7)",
            backdropFilter: "blur(4px)",
            color: c1,
            border: `1px solid ${c1}44`,
          }}
        >
          {durationLabel(durationSeconds)}
        </span>
      </div>

      {/* Info */}
      <div className="px-2.5 pt-2 pb-3">
        <div className="w-6 h-0.5 rounded-full mb-1.5" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
        <p className="text-white text-xs font-semibold leading-snug line-clamp-2 tracking-wide">{title}</p>
        {summary && (
          <p className="text-white/30 text-[10px] leading-snug mt-1 line-clamp-2">{summary}</p>
        )}
      </div>
    </Link>
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
        <h2 className="text-sm font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-[10px] font-semibold tracking-wider uppercase transition-opacity hover:opacity-80"
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

// ── Featured "Tonight's Pick" card ────────────────────────────────────────────

function FeaturedCard({ story, href }: { story: ClassicMeta | LibraryEntry; href: string }) {
  const title = story.title;
  const [c1, c2] = cardPalette(title);
  const coverUrl = "coverUrl" in story ? story.coverUrl : null;
  const summary = "summary" in story ? story.summary : ("tagline" in story ? (story as ClassicMeta).tagline : "");
  const durationSeconds = story.durationSeconds ?? 0;

  return (
    <div className="px-5 mb-8">
      <h2 className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
        Tonight&apos;s Pick ✨
      </h2>
      <Link
        href={href}
        className="block rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${c1}33`,
          boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 40px ${c1}18`,
        }}
      >
        <div className="relative" style={{ height: 200 }}>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-7xl"
              style={{ background: `linear-gradient(145deg, ${c1}22, ${c2}44)` }}
            >
              <span style={{ filter: `drop-shadow(0 0 20px ${c1}88)` }}>
                {"emoji" in story ? (story as ClassicMeta).emoji : "🌙"}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(5,8,20,0.92) 100%)" }}
          />
          {/* Text on image */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <p className="text-white font-bold text-lg leading-tight tracking-wide">{title}</p>
            {summary && <p className="text-white/55 text-xs mt-1 leading-snug line-clamp-2">{summary}</p>}
          </div>
          {/* Duration badge */}
          {durationSeconds > 0 && (
            <span
              className="absolute top-3 right-3 text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(5,8,20,0.65)",
                backdropFilter: "blur(4px)",
                color: c1,
                border: `1px solid ${c1}44`,
              }}
            >
              {durationLabel(durationSeconds)}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

// ── Child switcher pill ───────────────────────────────────────────────────────

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
      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
      style={active ? {
        background: "rgba(79,195,247,0.15)",
        border: "1px solid rgba(79,195,247,0.45)",
        color: "#4fc3f7",
      } : {
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {child.avatar_emoji?.startsWith("http") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={child.avatar_emoji}
          alt={child.name}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: 20, height: 20 }}
        />
      ) : (
        <span className="text-base leading-none">{child.avatar_emoji || "🧒"}</span>
      )}
      <span className="text-xs font-semibold">{child.name}</span>
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
      <span className="text-3xl" style={{ filter: "drop-shadow(0 0 12px rgba(167,139,250,0.5))" }}>💌</span>
      <div>
        <p className="text-white/50 text-sm font-medium">No stories shared yet</p>
        <p className="text-white/25 text-xs mt-1">Stories your family shares will appear here</p>
      </div>
    </div>
  );
}

// ── Create CTA ────────────────────────────────────────────────────────────────

function CreateCTA() {
  return (
    <div className="px-5 mb-10">
      <Link
        href="/studio2"
        className="flex items-center justify-between rounded-3xl px-5 py-4 transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, rgba(192,132,252,0.18) 0%, rgba(79,195,247,0.12) 100%)",
          border: "1px solid rgba(192,132,252,0.3)",
          boxShadow: "0 4px 32px rgba(192,132,252,0.15)",
        }}
      >
        <div>
          <p className="text-white font-bold text-base tracking-wide">Create a Story ✦</p>
          <p className="text-white/40 text-xs mt-0.5">Your next adventure awaits</p>
        </div>
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
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

// ── Main Home page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const { effective } = useViewMode();
  const isMobile = effective === "mobile";

  const [stories, setStories] = useState<LibraryEntry[]>([]);
  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [children, setChildren] = useState<DBChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hour, setHour] = useState(20);

  useEffect(() => {
    setHour(new Date().getHours());

    Promise.all([
      fetch("/api/library", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/classics", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/child-profiles", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([lib, cls, kids]) => {
        setStories(Array.isArray(lib) ? lib : []);
        setClassics(Array.isArray(cls) ? cls : []);
        const kidList: DBChildProfile[] = Array.isArray(kids) ? kids : [];
        setChildren(kidList);
        if (kidList.length > 0) setActiveChildId(kidList[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeChild = children.find((c) => c.id === activeChildId) ?? null;

  // "Tonight's Pick" — prefer a generated classic with a cover, else first classic, else first story
  const tonightsPick =
    classics.find((c) => c.status === "ready" && c.coverUrl) ??
    classics.find((c) => c.status === "ready") ??
    null;

  // Recent stories (last 6)
  const recentStories = stories.slice(0, 6);

  // "Continue" — last 3 stories (simulate resume; no real progress tracking yet)
  const continueStories = stories.slice(0, 3);

  const greetingText = greeting(hour);
  const greetingName = activeChild ? `, ${activeChild.name}` : "";

  return (
    <div className="cosmic-page min-h-full">
      {/* ── Header ── */}
      <div className="px-5 pt-12 pb-6">
        {/* Greeting */}
        <div className="mb-4">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #4fc3f7 50%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {greetingText}{greetingName} 🌙
          </h1>
          <p className="text-white/30 text-xs mt-1 tracking-wide">
            {stories.length > 0
              ? `${stories.length} ${stories.length === 1 ? "story" : "stories"} in your library`
              : "Ready to create your first story?"}
          </p>
        </div>

        {/* Child switcher */}
        {children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {children.map((child) => (
              <ChildPill
                key={child.id}
                child={child}
                active={child.id === activeChildId}
                onClick={() => setActiveChildId(child.id)}
              />
            ))}
          </div>
        )}
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
                href="/studio2"
                className="block rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, rgba(192,132,252,0.15) 0%, rgba(79,195,247,0.1) 100%)",
                  border: "1px solid rgba(192,132,252,0.3)",
                  padding: "40px 32px",
                  textAlign: "center",
                }}
              >
                <p className="text-5xl mb-4" style={{ filter: "drop-shadow(0 0 20px rgba(192,132,252,0.6))" }}>✨</p>
                <p className="text-white font-bold text-lg">Create your first story</p>
                <p className="text-white/40 text-sm mt-2">A magical adventure awaits</p>
              </Link>
            </div>
          )}

          {/* ── Shared with Me ── */}
          <Rail
            title="Shared with Me 💌"
            empty={<SharedEmptyState />}
          >
            {null}
          </Rail>

          {/* ── Tonight's Pick ── */}
          {tonightsPick && (
            <FeaturedCard
              story={tonightsPick}
              href={`/library/classics/${tonightsPick.id}`}
            />
          )}

          {/* ── Continue Listening ── */}
          {continueStories.length > 0 && (
            <Rail
              title="Continue Listening"
              action={{ label: "All Stories", href: "/library" }}
            >
              {continueStories.map((s) => (
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

          {/* ── Your Stories ── */}
          {recentStories.length > 0 && (
            <Rail
              title="Your Stories"
              action={{ label: "View All", href: "/library" }}
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

          {/* ── Classics ── */}
          {classics.length > 0 && (
            <Rail
              title="Classics ✨"
              action={{ label: "All Classics", href: "/library" }}
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
          {stories.length > 0 && <CreateCTA />}
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
