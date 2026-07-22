"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useViewMode } from "@/context/ViewModeContext";
import { useLanguage } from "@/context/LanguageContext";
import type { LibraryEntry, ContinueEntry } from "@/lib/libraryStore";
import type { ClassicMeta } from "@/lib/classicStories";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import SeriesCountBadge from "@/components/ui/SeriesCountBadge";
import StoryPoster from "@/components/ui/StoryPoster";
import { dedupeBySeries } from "@/lib/dedupeBySeries";

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

function durationLabel(seconds: number, unit: string): string {
  const m = Math.round(seconds / 60);
  return `${Math.max(1, m)} ${unit}`;
}

// Strips a trailing "- Chapter N" / "- פרק N" suffix so a series' representative
// card (post-dedupeBySeries) reads as the story's own name, not chapter 1's
// title — same helper as library/[id]/page.tsx's hero title.
function seriesDisplayTitle(title: string): string {
  return title.replace(/\s*-\s*(chapter|פרק)\s*\d+\s*$/i, "").trim();
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
  coverFocusX,
  coverFocusY,
  href,
  progressPercent,
  chapterLabel,
  chapterCount,
}: {
  title: string;
  summary?: string;
  coverUrl?: string | null;
  /** Percentages (0-100) — the same custom focus point set in Studio, so a
   *  cropped card keeps the same framing as everywhere else this cover shows. */
  coverFocusX?: number;
  coverFocusY?: number;
  href: string;
  progressPercent?: number;
  /** e.g. "Chapter 2 of 3" — text badge showing playback position within a series. */
  chapterLabel?: string;
  /** Total chapters in the series — shown as the episodes-icon count badge. */
  chapterCount?: number;
}) {
  const [c1, c2] = cardPalette(title);
  return (
    <Link
      href={href}
      className="flex-shrink-0 flex flex-col transition-all active:scale-[0.97] select-none"
      style={{ width: 130 }}
    >
      {/* The book itself stays clean — only small badge chips sit on the
          jacket; title/chapter/progress live below it in normal flow. */}
      <div className="relative w-full" style={{ height: 180 }}>
        {coverUrl ? (
          <StoryPoster coverUrl={coverUrl} alt={title} borderRadius={10} focusX={coverFocusX} focusY={coverFocusY} />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-5xl rounded-2xl overflow-hidden"
            style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}66)`, border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span style={{ filter: `drop-shadow(0 0 16px ${c1}aa)` }}>🌙</span>
          </div>
        )}
      </div>

      {/* Progress bar — directly under the book (Continue Listening).
          Width matches the cover (96% of the box) so it doesn't overhang
          the page edge. Hidden entirely at 0% (never started) rather than
          showing the 4%-floor sliver below — that floor is only meant to
          keep genuine tiny-but-real progress visible, not to imply
          progress that doesn't exist yet. */}
      {progressPercent !== undefined && progressPercent > 0 && (
        <div className="h-[3px] rounded-full mt-2" style={{ width: "96%", background: "rgba(255,255,255,0.12)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(4, Math.min(100, progressPercent))}%`,
              background: `linear-gradient(90deg, ${c1}, ${c2})`,
            }}
          />
        </div>
      )}

      {/* Title + chapter info — below the physical book */}
      <p className="text-white text-fs-body font-bold leading-tight line-clamp-2 tracking-wide mt-2 pr-1">{title}</p>
      {chapterLabel ? (
        <p className="text-fs-caption mt-0.5" style={{ color: "rgba(79,195,247,0.85)" }}>{chapterLabel}</p>
      ) : (
        !!chapterCount && chapterCount > 1 && (
          <div className="flex items-center mt-0.5">
            <span className="ml-auto"><SeriesCountBadge count={chapterCount} size="sm" /></span>
          </div>
        )
      )}
    </Link>
  );
}

// ── Hero banner (Netflix-style featured story) ────────────────────────────────

function HeroBanner({ story, progressPercent = 42, isPromoted = false, tFn }: { story: LibraryEntry; progressPercent?: number; isPromoted?: boolean; tFn: (key: string) => string }) {
  const [c1, c2] = cardPalette(story.title);
  const remaining = !isPromoted && story.durationSeconds > 0
    ? durationLabel(Math.round(story.durationSeconds * (1 - progressPercent / 100)), tFn("minutes"))
    : null;

  return (
    <Link
      href={`/library/${story.id}`}
      className="relative block overflow-hidden mx-5 mb-6 rounded-3xl select-none transition-all active:scale-[0.98]"
      style={{
        height: 260,
        boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 64px ${c1}18`,
        border: `1px solid ${c1}22`,
      }}
    >
      {/* Cover art */}
      {story.coverUrl ? (
        // Falls back to the same top-biased default crop as before — generated
        // covers are square with the character's face in the top ~15-45%, so a
        // center crop into this short wide banner cuts the head off — but uses
        // the story's own custom focus point (set in Studio) when one exists.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.coverUrl}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.75)", objectPosition: `${story.coverFocusX ?? 50}% ${story.coverFocusY ?? 30}%` }}
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
        {/* Label — only for an editorial "Featured" pick; the generic
            "Continue Listening" status was redundant with the Continue
            button right below it, so that case renders nothing here. */}
        {isPromoted && (
          <span
            className="inline-block text-fs-body font-bold tracking-widest uppercase mb-2 px-2 py-0.5 rounded-full"
            style={{ background: "rgba(79,195,247,0.18)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }}
          >
            {tFn("featuredBadge")}
          </span>
        )}

        {/* Title */}
        <h2
          className="text-white font-bold leading-tight mb-3 line-clamp-2"
          style={{ fontSize: "var(--fs-title)", letterSpacing: "-0.01em" }}
        >
          {story.title}
        </h2>

        {/* Progress bar — only meaningful for an actual in-progress story;
            hidden at 0% (never started) rather than showing an empty track. */}
        {!isPromoted && progressPercent > 0 && (
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
        )}

        {/* CTA row — the whole banner is a single Link now, so this is just
            a visual affordance, not a separate click target. */}
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold"
            style={{
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              color: "#fff",
              fontSize: "var(--fs-body)",
              boxShadow: `0 4px 16px ${c1}55`,
            }}
          >
            {isPromoted ? tFn("listenNowButton") : tFn("continueButton")}
          </span>
          {remaining && (
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
              {remaining} {tFn("timeLeft")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Scroll arrows (shared by Rail and TonightsPicksRail) ─────────────────────
// Arrows only render on whichever side still has more to scroll to — same
// pattern as Library's FilterChipRow, applied here since these rails had no
// way to tell there was more content besides a raw touch-drag.

function useScrollArrows(depsKey: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateArrows); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateArrows, depsKey]);

  const scrollBy = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return { scrollRef, canScrollLeft, canScrollRight, scrollBy };
}

// zIndex must beat StoryPoster's own hover z-index (20, in StoryPoster.tsx —
// bumped so a scaled-up card paints over its flat siblings) — otherwise
// hovering the last card right under an arrow raises that card above it,
// hiding the arrow behind the enlarged poster.
const RAIL_ARROW_STYLE: React.CSSProperties = {
  position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 30,
  width: 32, height: 32, borderRadius: "50%",
  background: "rgba(5,8,20,0.85)", border: "1px solid rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 20, fontWeight: 700, lineHeight: 1,
  boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
};

function RailArrows({
  canScrollLeft,
  canScrollRight,
  scrollBy,
}: {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollBy: (dir: 1 | -1) => void;
}) {
  return (
    <>
      {canScrollLeft && (
        <button onClick={() => scrollBy(-1)} aria-label="Scroll left" style={{ ...RAIL_ARROW_STYLE, left: 4 }}>‹</button>
      )}
      {canScrollRight && (
        <button onClick={() => scrollBy(1)} aria-label="Scroll right" style={{ ...RAIL_ARROW_STYLE, right: 4 }}>›</button>
      )}
    </>
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
  const hasChildren = !!children && (Array.isArray(children) ? children.length > 0 : true);
  const { scrollRef, canScrollLeft, canScrollRight, scrollBy } = useScrollArrows(children);

  return (
    <section className="mb-8">
      {/* Rail header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-fs-body font-semibold tracking-widest uppercase" style={{ color: "rgba(79,195,247,0.85)" }}>
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-fs-body font-semibold tracking-wider uppercase transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            {action.label} →
          </Link>
        )}
      </div>

      {hasChildren ? (
        <div className="relative">
          <RailArrows canScrollLeft={canScrollLeft} canScrollRight={canScrollRight} scrollBy={scrollBy} />
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto px-5 pb-1"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
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
  /** Percentages (0-100) — the same custom focus point set in Studio. */
  coverFocusX?: number;
  coverFocusY?: number;
  durationSeconds: number;
  href: string;
  tag: "Your Story" | "Classic";
  emoji?: string;
  /** Total chapters in the series this pick represents — shown as a badge when > 1. */
  chapterCount?: number;
};

function TonightsPickCard({ item, tFn }: { item: PickItem; tFn: (key: string) => string }) {
  const [c1, c2] = cardPalette(item.title);
  const isOwn = item.tag === "Your Story";

  return (
    <Link
      href={item.href}
      className="flex-shrink-0 flex flex-col transition-all active:scale-[0.97] select-none"
      style={{ width: 200 }}
    >
      {/* Clean jacket — only the small Classic/series chips sit on the
          cover; title lives below the book. */}
      <div className="relative w-full" style={{ height: 275 }}>
        {item.coverUrl ? (
          <StoryPoster
            coverUrl={item.coverUrl}
            alt={item.title}
            borderRadius={14}
            focusX={item.coverFocusX}
            focusY={item.coverFocusY}
            overlay={
              !isOwn ? (
                <span
                  className="absolute top-3 left-3 text-fs-body font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(251,191,36,0.22)", border: "1px solid rgba(251,191,36,0.45)", color: "#fbbf24", backdropFilter: "blur(8px)" }}
                >
                  {tFn("classicBadge")}
                </span>
              ) : undefined
            }
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-6xl rounded-3xl overflow-hidden"
            style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}66)`, border: `1px solid ${c1}28` }}
          >
            <span style={{ filter: `drop-shadow(0 0 20px ${c1}aa)` }}>
              {item.emoji ?? "🌙"}
            </span>
            {!isOwn && (
              <span
                className="absolute top-3 left-3 text-fs-body font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,191,36,0.22)", border: "1px solid rgba(251,191,36,0.45)", color: "#fbbf24", backdropFilter: "blur(8px)" }}
              >
                {tFn("classicBadge")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Title — below the physical book */}
      <div className="mt-2.5 pr-1">
        <div className="w-7 h-[2px] rounded-full mb-1.5" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
        <div className="flex items-start gap-2">
          <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide flex-1">{item.title}</p>
          {!!item.chapterCount && item.chapterCount > 1 && (
            <span className="flex-shrink-0"><SeriesCountBadge count={item.chapterCount} size="sm" /></span>
          )}
        </div>
      </div>
    </Link>
  );
}

function TonightsPicksRail({ picks, tFn }: { picks: PickItem[]; tFn: (key: string) => string }) {
  const { scrollRef, canScrollLeft, canScrollRight, scrollBy } = useScrollArrows(picks.length);
  if (picks.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-fs-body font-semibold tracking-widest uppercase" style={{ color: "rgba(79,195,247,0.85)" }}>
          {tFn("tonightsPicks")}
        </h2>
      </div>
      <div className="relative">
        <RailArrows canScrollLeft={canScrollLeft} canScrollRight={canScrollRight} scrollBy={scrollBy} />
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-5 pb-1"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {picks.map((item, i) => (
            <TonightsPickCard key={i} item={item} tFn={tFn} />
          ))}
        </div>
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
  const avatarSize = active ? 83 : 64;
  const buttonWidth = active ? 94 : 72;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2 active:scale-95"
      style={{ width: buttonWidth, transition: "width 0.2s ease" }}
    >
      {/* Avatar with selection ring */}
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
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

// ── Community stories empty state ────────────────────────────────────────────
// Same "coming soon" copy as Library's Community tab (communityStories/
// communityStoriesSoon) — public/non-classic stories aren't populated yet.

function CommunityEmptyState({ tFn }: { tFn: (key: string) => string }) {
  return (
    <div
      className="rounded-2xl px-5 py-6 flex flex-col items-center gap-3 text-center"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px dashed rgba(255,255,255,0.1)",
      }}
    >
      <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 12px rgba(79,195,247,0.5))" }}>🌍</span>
      <div>
        <p className="text-white/50 text-fs-body font-medium">{tFn("communityStories")}</p>
        <p className="text-white/48 text-fs-body mt-1 max-w-[220px]">{tFn("communityStoriesSoon")}</p>
      </div>
    </div>
  );
}

// ── Create CTA ────────────────────────────────────────────────────────────────

const CTA_SUBTITLE_KEYS = ["ctaSubtitle1", "ctaSubtitle2", "ctaSubtitle3", "ctaSubtitle4", "ctaSubtitle5"];

function CreateCTA({ childName, tFn }: { childName?: string; tFn: (key: string) => string }) {
  const [subtitleIdx] = useState(() => Math.floor(Math.random() * CTA_SUBTITLE_KEYS.length));
  const subtitle = tFn(CTA_SUBTITLE_KEYS[subtitleIdx]).replace("{name}", childName ?? tFn("ctaNameFallback"));

  return (
    <div className="px-5 mb-10">
      <Link
        href="/studio?start=prompt"
        className="relative flex items-center overflow-hidden rounded-3xl px-5 py-6 transition-all active:scale-[0.98]"
        style={{
          background: "#0d0f22",
          border: "1px solid rgba(192,132,252,0.3)",
          boxShadow: "0 4px 32px rgba(192,132,252,0.15)",
        }}
      >
        {/* Static asset — swap /public/cta-bubble-worlds.webp to try a different version.
            Half-width, right-aligned decorative strip rather than a full-bleed
            background — at full width/height the wide bubble row was stretched
            and cropped oddly against this panel's short, text-driven height. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cta-bubble-worlds.webp"
          alt=""
          className="absolute right-0 top-0 h-full object-cover"
          style={{ width: "65%" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(8,11,24,0.9) 0%, rgba(8,11,24,0.55) 60%, rgba(8,11,24,0.15) 100%)" }}
        />
        <div className="relative">
          <p className="text-white font-bold text-fs-heading tracking-wide">{tFn("createNewStoryHeading")}</p>
          <p className="text-white/50 text-fs-body mt-0.5">{subtitle}</p>
        </div>
      </Link>
    </div>
  );
}

// ── Main Home page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effective } = useViewMode();
  const { t } = useLanguage();
  const isMobile = effective === "mobile";

  // Non-destructive way to eyeball the brand-new-user empty state without
  // actually deleting your library — visit /home?preview=empty. Doesn't
  // touch the DB or affect any other user; purely hides real data client-side
  // for this one render. Real children/classics/promoted story stay intact
  // so it reflects "just finished onboarding," not "logged out."
  const previewEmpty = searchParams.get("preview") === "empty";

  const [storiesRaw, setStories] = useState<LibraryEntry[]>([]);
  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [children, setChildren] = useState<DBChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [familyStoriesRaw, setFamilyStories] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const stories = previewEmpty ? [] : storiesRaw;
  const familyStories = previewEmpty ? [] : familyStoriesRaw;
  // Tracks the SEPARATE per-child stories fetch below — without this, once
  // the first fetch (classics/children/familyStories) resolves and flips
  // `loading` false, there's a window where `stories` is still its initial
  // empty array while the child-scoped fetch is in flight, briefly showing
  // the "Create your first story" empty state before real stories arrive.
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [hour, setHour] = useState(20);
  const [promotedStory, setPromotedStory] = useState<LibraryEntry | null>(null);
  const [continueEntries, setContinueEntries] = useState<ContinueEntry[]>([]);
  const [communityStories, setCommunityStories] = useState<LibraryEntry[]>([]);

  // Load children + classics + all-family stories once on mount
  useEffect(() => {
    setHour(new Date().getHours());
    Promise.all([
      fetch("/api/classics", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/child-profiles", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library/promoted", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/community", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
    ])
      .then(([cls, kids, allLib, promoted, community]) => {
        setClassics(Array.isArray(cls) ? cls : []);
        const kidList: DBChildProfile[] = Array.isArray(kids) ? kids : [];
        setChildren(kidList);
        setFamilyStories(Array.isArray(allLib) ? allLib : []);
        setPromotedStory(promoted ?? null);
        setCommunityStories(Array.isArray(community) ? community : []);

        // First-time family — send them through the "add your child" wizard
        // instead of dropping them on an empty home screen. Once they've
        // been through it (or explicitly skipped it), never nag again.
        if (kidList.length === 0 && !localStorage.getItem("ns-onboarding-done")) {
          router.replace("/onboarding");
          return;
        }
        const savedId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
        const firstId = savedId && kidList.find((k) => k.id === savedId) ? savedId : kidList[0]?.id ?? null;
        setActiveChildId(firstId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch stories whenever the active child changes
  useEffect(() => {
    if (activeChildId === null) {
      // Only settle once the initial load has confirmed there's no child to
      // scope by at all (as opposed to just not having resolved yet) —
      // otherwise this fires immediately on mount and defeats the guard.
      if (!loading) setStoriesLoading(false);
      return;
    }
    setStoriesLoading(true);
    fetch(`/api/library?childId=${encodeURIComponent(activeChildId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((lib) => setStories(Array.isArray(lib) ? lib : []))
      .catch(() => {})
      .finally(() => setStoriesLoading(false));

    // Chapter-level "resume where you left off" — real data from listening_progress,
    // returns [] before that migration has run (see getContinueListening).
    fetch(`/api/library/continue?childId=${encodeURIComponent(activeChildId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((entries) => setContinueEntries(Array.isArray(entries) ? entries : []))
      .catch(() => setContinueEntries([]));
  }, [activeChildId, loading]);

  // Persist active child selection across sessions
  const handleChildSwitch = (id: string) => {
    setActiveChildId(id);
    localStorage.setItem("ns-active-child-id", id);
  };

  const activeChild = children.find((c) => c.id === activeChildId) ?? null;

  // Multi-chapter stories recommend as a single unit — collapse each series
  // down to its earliest chapter before building any browse/recommend rail.
  const dedupedStories = dedupeBySeries(stories);
  const readyClassics = dedupeBySeries(classics.filter((c) => c.status === "ready"));
  // Same reasoning for the plain Classics/Family Stories browse rails below —
  // these previously mapped over the raw arrays directly, so a multi-chapter
  // classic (or family story) showed one card per chapter instead of once.
  const dedupedClassicsRail = dedupeBySeries(classics);
  const dedupedFamilyStories = dedupeBySeries(familyStories);
  const dedupedCommunityStories = dedupeBySeries(communityStories);

  // "Shared with Me" isn't wired up yet — nothing ever populates this, so the
  // rail stays hidden until real shared-story data lands here.
  const sharedStories: LibraryEntry[] = [];

  // "Tonight's Picks" — up to 2 user stories + up to 3 ready classics, interleaved
  const tonightsPicks: PickItem[] = [
    ...dedupedStories.slice(0, 2).map((s) => ({
      title: s.title,
      summary: s.summary ?? "",
      coverUrl: s.coverUrl,
      coverFocusX: s.coverFocusX,
      coverFocusY: s.coverFocusY,
      durationSeconds: s.durationSeconds,
      href: `/library/${s.id}`,
      tag: "Your Story" as const,
      chapterCount: s.chapterCount,
    })),
    ...readyClassics.slice(0, 3).map((c) => ({
      title: c.title,
      summary: c.tagline,
      coverUrl: c.coverUrl,
      durationSeconds: c.durationSeconds ?? 0,
      href: `/library/classics/${c.id}`,
      tag: "Classic" as const,
      emoji: c.emoji,
      chapterCount: c.chapterCount,
    })),
  ];

  // Recent stories (last 6) — series-deduped, same reasoning as Tonight's Picks
  const recentStories = dedupedStories.slice(0, 6);

  // "Continue Listening" — real per-chapter resume data from listening_progress
  // (see getContinueListening); a story that's part of a series still shows
  // the exact chapter being resumed, not the series as a whole.
  const continueStories = continueEntries;

  // Hero banner story — an admin-promoted pick takes priority, then the most
  // recently-resumed chapter, then falls back to the newest story if nothing
  // has real progress yet.
  const heroStory = promotedStory ?? continueEntries[0] ?? dedupedStories[0];
  const heroProgressPercent = promotedStory ? 0 : continueEntries[0]?.progressPercent ?? 0;

  // "My List" — stories + classics the active child has favorited. Checked
  // against familyStories (not just `stories`) so a favorite sticks even if
  // the story was originally created under a different child profile.
  // Classics are public (is_public: true) so they never show up in
  // familyStories — merged in separately from the classics feed instead.
  type MyListItem = { id: string; title: string; summary: string; coverUrl?: string; coverFocusX?: number; coverFocusY?: number; href: string };
  const myList: MyListItem[] = activeChildId
    ? [
        // dedupeBySeries runs AFTER the favorite filter (not before, like the
        // other rails) — favoriting is per-chapter, so collapsing to chapter
        // 1 first could drop a favorite that was only marked on chapter 2+.
        // This only merges cards when multiple chapters of the same series
        // both happen to be favorited.
        ...dedupeBySeries(familyStories.filter((s) => s.favoritedBy?.includes(activeChildId)))
          .map((s) => ({ id: s.id, title: s.title, summary: s.summary ?? "", coverUrl: s.coverUrl, coverFocusX: s.coverFocusX, coverFocusY: s.coverFocusY, href: `/library/${s.id}` })),
        ...dedupeBySeries(classics.filter((c) => c.favoritedBy?.includes(activeChildId)))
          .map((c) => ({ id: c.id, title: c.title, summary: c.tagline, coverUrl: c.coverUrl, href: `/library/classics/${c.id}` })),
      ]
    : [];

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
            <p className="text-white/55 text-fs-body mt-1 tracking-wide">
              {stories.length > 0
                ? `${stories.length} ${stories.length === 1 ? t("storySingular") : t("storyPlural")} ${t("inYourLibrary")}`
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
          <div className="flex gap-4 overflow-x-auto pb-4 pt-4" style={{ scrollbarWidth: "none" }}>
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

        {/* Journey snapshot — hidden for now (same as Profile's Story Journey
            panel): this runs entirely on MOCK_JOURNEY's 2 hardcoded example
            children, not real per-child tracking, so it isn't ready to show. */}
      </div>

      {/* ── Content ── */}
      {/* Only the true first load (before any child/story data has ever
          rendered) shows the skeleton. Switching the active child re-fetches
          via storiesLoading, but the previous rails stay mounted and just
          dim briefly -- swapping the whole tree for a differently-sized
          skeleton on every switch was causing layout shift and a jarring
          full unmount/remount each time. */}
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
        <div
          style={{
            opacity: storiesLoading ? 0.5 : 1,
            pointerEvents: storiesLoading ? "none" : "auto",
            transition: "opacity 0.2s ease",
          }}
        >
          {/* Create CTA — prominent at top when no stories yet. Gated on
              !storiesLoading too — `stories` starts as [] before the
              per-child fetch resolves, so without this it flashed this
              empty-state banner (then swapped to the hero banner) even for
              a returning user who already has stories. */}
          {!storiesLoading && stories.length === 0 && (
            <div className="px-5 mb-8">
              <Link
                href="/studio?start=prompt"
                className="relative block rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
                style={{ height: 220, background: "#0d0f22", border: "1px solid rgba(192,132,252,0.3)" }}
              >
                {/* Static asset — swap /public/cta-bubble-worlds.webp to try a different version */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cta-bubble-worlds.webp"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(8,11,24,0.95) 0%, rgba(8,11,24,0.55) 45%, rgba(8,11,24,0.15) 100%)" }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-end text-center px-8 pb-7">
                  <p
                    className="font-extrabold text-fs-title tracking-tight"
                    style={{
                      background: "linear-gradient(135deg, #fff 0%, #e9d5ff 55%, #c084fc 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      filter: "drop-shadow(0 2px 16px rgba(192,132,252,0.45))",
                    }}
                  >
                    {t("createFirstStoryHeading")}
                  </p>
                  <p className="text-white/60 text-fs-body font-medium mt-2">{t("magicalAdventure")} →</p>
                </div>
              </Link>
            </div>
          )}

          {/* ── Hero banner — admin-promoted pick, or Continue Listening fallback ── */}
          {heroStory && (
            <HeroBanner story={heroStory} progressPercent={heroProgressPercent} isPromoted={!!promotedStory} tFn={t} />
          )}

          {/* ── Tonight's Picks ── */}
          <TonightsPicksRail picks={tonightsPicks} tFn={t} />

          {/* ── Continue Listening rail — real per-chapter resume data.
              No "View all": the Stories tab has no in-progress/resume filter,
              so there's nowhere that link could actually take you to "the
              rest of this list" — it would just dump you in a generic tab. ── */}
          {continueStories.length > 0 && (
            <Rail
              title={t("continueListening")}
            >
              {continueStories.map((s) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  coverFocusX={s.coverFocusX}
                  coverFocusY={s.coverFocusY}
                  href={`/library/${s.id}`}
                  progressPercent={s.progressPercent}
                  chapterLabel={s.chapterNumber && s.chapterCount ? t("chapterOfLabel").replace("{n}", String(s.chapterNumber)).replace("{count}", String(s.chapterCount)) : undefined}
                />
              ))}
            </Rail>
          )}

          {/* ── My List (favorited stories) — no "View all": the Stories tab
              has no favorites filter, so there's no matching list to send
              this to. ── */}
          {myList.length > 0 && (
            <Rail
              title={t("myList")}
            >
              {myList.map((s) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  coverFocusX={s.coverFocusX}
                  coverFocusY={s.coverFocusY}
                  href={s.href}
                />
              ))}
            </Rail>
          )}

          {/* ── Shared with Me ── */}
          {/* Hidden entirely while empty — sharing-into-library isn't wired
              up yet, so sharedStories is always []. Placed above Your
              Stories so a real shared story surfaces before the user's own
              once this is populated. */}
          {sharedStories.length > 0 && (
            <Rail
              title={t("sharedWithMe")}
            >
              {sharedStories.map((s) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  coverFocusX={s.coverFocusX}
                  coverFocusY={s.coverFocusY}
                  href={`/library/${s.id}`}
                />
              ))}
            </Rail>
          )}

          {/* ── Your Stories ── */}
          {recentStories.length > 0 && (
            <Rail
              title={t("yourStories")}
              action={{ label: t("viewAll"), href: "/library?tab=my-stories" }}
            >
              {recentStories.map((s) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  coverFocusX={s.coverFocusX}
                  coverFocusY={s.coverFocusY}
                  href={`/library/${s.id}`}
                  chapterCount={s.chapterCount}
                />
              ))}
            </Rail>
          )}

          {/* ── Family Stories ── */}
          {/* Only meaningful once there's more than one child profile —
              with a single child, "family" stories and "your" stories are
              the same list, so this rail would just duplicate the one above. */}
          {children.length > 1 && familyStories.length > 0 && (
            <Rail
              title={t("familyStoriesSection")}
              action={{ label: t("viewAll"), href: "/library?tab=family" }}
            >
              {dedupedFamilyStories.slice(0, 8).map((s) => (
                <StoryCard
                  key={s.id}
                  title={s.title}
                  summary={s.summary}
                  coverUrl={s.coverUrl}
                  coverFocusX={s.coverFocusX}
                  coverFocusY={s.coverFocusY}
                  href={`/library/${s.id}`}
                />
              ))}
            </Rail>
          )}

          {/* ── Classics ── */}
          {classics.length > 0 && (
            <Rail
              title={t("classicsSection")}
              action={{ label: t("allClassics"), href: "/library?tab=classics" }}
            >
              {dedupedClassicsRail.slice(0, 8).map((c) => (
                <StoryCard
                  key={c.id}
                  title={c.chapterCount && c.chapterCount > 1 ? seriesDisplayTitle(c.title) : c.title}
                  summary={"tagline" in c ? (c as ClassicMeta).tagline : ""}
                  coverUrl={c.coverUrl}
                  href={`/library/classics/${c.id}`}
                  chapterCount={c.chapterCount}
                />
              ))}
            </Rail>
          )}

          {/* ── Community Stories ── */}
          <Rail
            title={t("communityStories")}
            action={dedupedCommunityStories.length > 0 ? { label: t("viewAll"), href: "/library?tab=community" } : undefined}
            empty={<CommunityEmptyState tFn={t} />}
          >
            {dedupedCommunityStories.slice(0, 8).map((s) => (
              <StoryCard
                key={s.id}
                title={s.title}
                summary={s.summary}
                coverUrl={s.coverUrl}
                coverFocusX={s.coverFocusX}
                coverFocusY={s.coverFocusY}
                href={`/library/${s.id}`}
              />
            ))}
          </Rail>

          {/* ── Create CTA (bottom) ── */}
          {stories.length > 0 && <CreateCTA childName={activeChild?.name} tFn={t} />}
        </div>
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
