"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode } from "@/context/ViewModeContext";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { ClassicMeta } from "@/lib/classicStories";
import Icon from "@/components/ui/Icon";
import SeriesCountBadge from "@/components/ui/SeriesCountBadge";
import StoryPoster from "@/components/ui/StoryPoster";
import { dedupeBySeries } from "@/lib/dedupeBySeries";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import { getLessonsCatalog } from "@/constants/lessonsUi";
import { LANGUAGE_META } from "@/lib/i18n";
import type { Language } from "@/types";


// Results shown per "page" before the "Next stories" button reveals more.
const PAGE_SIZE = 30;

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

// Strips a trailing "- Chapter N" / "- פרק N" suffix so a collapsed series
// card reads as the story's name, not just its first chapter's title.
function seriesDisplayTitle(title: string): string {
  return title.replace(/\s*-\s*(chapter|פרק)\s*\d+\s*$/i, "").trim();
}

function formatDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Same 7 moods scenes are tagged with (see story-guidance.txt's SCENE
// BREAKDOWN section) — one color/emoji per mood, reused for the library's
// mood filter chips.
const MOODS: { id: string; emoji: string; color: string }[] = [
  { id: "Gentle",    emoji: "🌤️", color: "#4fc3f7" },
  { id: "Whimsical", emoji: "✨",  color: "#a78bfa" },
  { id: "Playful",   emoji: "🎈",  color: "#fbbf24" },
  { id: "Tense",     emoji: "⚡",  color: "#fb923c" },
  { id: "Soothing",  emoji: "🌊",  color: "#10b981" },
  { id: "Wondrous",  emoji: "🌟",  color: "#f472b6" },
  { id: "Cozy",      emoji: "🕯️", color: "#f59e0b" },
];

// A story doesn't have one mood of its own — only its scenes do — so this
// picks the most common primaryMood across them (first one wins a tie) as
// the story-level mood shown/filtered on in the library.
function dominantMood(entry: { scenes?: { primaryMood?: string }[] }): string | undefined {
  const moods = (entry.scenes ?? []).map((s) => s.primaryMood).filter(Boolean) as string[];
  if (moods.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const m of moods) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = 0;
  for (const m of moods) {
    const c = counts.get(m)!;
    if (c > bestCount) { best = m; bestCount = c; }
  }
  return best;
}

// ── Classics tab ─────────────────────────────────────────────────────────────

function ClassicsTab({ classics, loading, onClassicUpdated, matchesFilter }: {
  classics: ClassicMeta[];
  loading: boolean;
  onClassicUpdated: (updated: ClassicMeta) => void;
  /** Shared search/mood/lesson/language filter from the parent's one unified
   *  search bar — the background auto-generate effect below still scans the
   *  full unfiltered `classics` list, only the display grid is filtered. */
  matchesFilter: (c: ClassicMeta) => boolean;
}) {
  const { effective } = useViewMode();
  const { t } = useLanguage();

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const seedingRef = useRef(false);

  // Background: generate missing classics one by one
  useEffect(() => {
    if (loading || seedingRef.current) return;
    const pending = classics.filter((c) => c.status === "pending");
    if (pending.length === 0) return;

    seedingRef.current = true;

    (async () => {
      for (const c of pending) {
        setGeneratingId(c.id);
        try {
          const res = await fetch("/api/classics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: c.id }),
          });
          if (res.ok) {
            const { meta } = await res.json() as { meta: ClassicMeta };
            onClassicUpdated(meta);
          }
        } catch {
          // keep as pending, retry on next load
        }
      }
      setGeneratingId(null);
      seedingRef.current = false;
    })();
  }, [loading, classics, onClassicUpdated]);

  if (loading) {
    return (
      <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ background: "rgba(255,255,255,0.04)", aspectRatio: "2/3", animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    );
  }

  const filtered = dedupeBySeries(classics.filter(matchesFilter));

  return (
    <div className="pt-2">
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-16 gap-3 text-center">
          <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
          <p className="text-white/40 text-fs-body">{t("noClassicsMatch")}</p>
        </div>
      )}

    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: effective === "desktop" ? "repeat(4, 1fr)" : effective === "tablet" ? "repeat(3, 1fr)" : "repeat(3, 1fr)" }}
    >
      {filtered.map((meta) => {
        const isGenerating = generatingId === meta.id;
        const [c1, c2] = cardPalette(meta.title);
        const duration = formatDuration(meta.durationSeconds);
        const langCode = meta.language?.slice(0, 2).toUpperCase();
        const isSeries = !!meta.chapterCount && meta.chapterCount > 1;
        const displayTitle = isSeries ? seriesDisplayTitle(meta.title) : meta.title;

        const cardBody = (
          <>
            {/* Image — StoryPoster handles its own hover grow/tilt/shadow
                bloom internally; the grid's own gap-3 plus this p-1 give it
                enough room that a grown card doesn't visually collide with
                its neighbors. */}
            <div className="relative w-full p-1" style={{ aspectRatio: "2/3" }}>
              {meta.coverUrl ? (
                <StoryPoster coverUrl={meta.coverUrl} alt={displayTitle} borderRadius={8} />
              ) : (
                <div className="absolute inset-1 flex items-center justify-center text-fs-display rounded-lg overflow-hidden"
                  style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}55)` }}>
                  <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>
                    {isGenerating ? "✨" : meta.emoji}
                  </span>
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-1 flex items-center justify-center rounded-lg overflow-hidden"
                  style={{ background: "rgba(5,8,20,0.55)", backdropFilter: "blur(4px)" }}>
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${c1} transparent transparent transparent` }} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="px-2 pt-2 pb-2.5">
              <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{displayTitle}</p>
              {(duration || langCode || isSeries) && (
                <div className="flex items-center gap-1 mt-1">
                  {duration && (
                    <span
                      className="text-fs-caption tracking-wide"
                      style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.4)" }}
                    >
                      {duration}
                    </span>
                  )}
                  {langCode && (
                    <span
                      className="text-fs-caption font-semibold tracking-wide"
                      style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.4)" }}
                    >
                      {langCode}
                    </span>
                  )}
                  {isSeries && <span className="ml-auto"><SeriesCountBadge count={meta.chapterCount!} size="sm" /></span>}
                </div>
              )}
              {meta.status === "pending" && (
                <p className="text-fs-body mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>{t("pending")}</p>
              )}
            </div>
          </>
        );

        return (
          <Link
            key={meta.id}
            href={`/library/classics/${meta.id}`}
            className="flex flex-col rounded-xl overflow-hidden transition-all active:scale-[0.97] select-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {cardBody}
          </Link>
        );
      })}
    </div>
    </div>
  );
}

// ── Main Library page ─────────────────────────────────────────────────────────

type LibraryTab = "all" | "my-stories" | "family" | "classics" | "community";

// ── Family Stories grid with per-card child assignment ────────────────────────

function ChildAvatar({ child, size = 22 }: { child: DBChildProfile; size?: number }) {
  if (child.avatar_emoji?.startsWith("http")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={child.avatar_emoji} alt={child.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return <span style={{ fontSize: size * 0.75, flexShrink: 0, lineHeight: 1 }}>{child.avatar_emoji || "🧒"}</span>;
}

function FamilyStoriesGrid({
  entries,
  children,
  effective,
  onAssigned,
}: {
  entries: LibraryEntry[];
  children: DBChildProfile[];
  effective: string;
  onAssigned: (storyId: string, childIds: string[]) => void;
}) {
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null);
  const [pickerSelections, setPickerSelections] = useState<Record<string, string[]>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  const openPicker = (storyId: string, currentChildIds: string[]) => {
    setPickerSelections((prev) => ({ ...prev, [storyId]: [...currentChildIds] }));
    setPickerOpenId(storyId);
  };

  const toggleChild = (storyId: string, childId: string) => {
    setPickerSelections((prev) => {
      const cur = prev[storyId] ?? [];
      const next = cur.includes(childId) ? cur.filter((id) => id !== childId) : [...cur, childId];
      return { ...prev, [storyId]: next };
    });
  };

  const saveAssignment = async (storyId: string) => {
    const childIds = pickerSelections[storyId] ?? [];
    setAssigning(storyId);
    try {
      await fetch(`/api/library/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childIds }),
      });
      onAssigned(storyId, childIds);
    } finally {
      setAssigning(null);
      setPickerOpenId(null);
    }
  };

  return (
    <>
    <div
      className="grid gap-3 pt-2"
      style={{ gridTemplateColumns: effective === "desktop" ? "repeat(4, 1fr)" : "repeat(3, 1fr)" }}
    >
      {entries.map((entry) => {
        const [c1, c2] = cardPalette(entry.title);
        const assignedChildIds = entry.childIds ?? [];
        const assignedChildren = children.filter((c) => assignedChildIds.includes(c.id));
        const isPickerOpen = pickerOpenId === entry.id;
        const isAssigning = assigning === entry.id;
        const pendingSelections = pickerSelections[entry.id] ?? assignedChildIds;

        return (
          <div key={entry.id} className="flex flex-col">
            <div className="relative" style={{ aspectRatio: "2/3" }}>
              <Link
                href={`/library/${entry.id}`}
                className="absolute inset-1 transition-all active:scale-[0.97] select-none block"
              >
                {entry.coverUrl ? (
                  <StoryPoster coverUrl={entry.coverUrl} alt={entry.title} borderRadius={8} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden"
                    style={{ background: `linear-gradient(145deg,${c1}33,${c2}55)` }}>
                    <span className="text-fs-display" style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>🌙</span>
                  </div>
                )}
              </Link>

            {/* Avatar seal — sits over the bottom-middle of the jacket like a
                sticker; "+Assign" pill takes its place when unassigned */}
            {children.length > 0 && (
              <div className="absolute left-0 right-0 px-1.5" style={{ bottom: 12, zIndex: 10 }}>
                {assignedChildren.length > 0 ? (
                  /* Clickable avatar row replaces the button once assigned */
                  <button
                    onClick={(e) => { e.preventDefault(); isPickerOpen ? setPickerOpenId(null) : openPicker(entry.id, assignedChildIds); }}
                    className="w-full flex items-center justify-center py-1 transition-all active:scale-95"
                    style={{ background: "transparent" }}
                  >
                    {isAssigning ? (
                      <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>…</span>
                    ) : (
                      <div className="flex" style={{ gap: 0 }}>
                        {assignedChildren.slice(0, 3).map((child, i) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-center rounded-full overflow-hidden"
                            style={{
                              width: 36, height: 36,
                              background: "#0D1120",
                              border: "2.5px solid rgba(79,195,247,0.55)",
                              marginLeft: i > 0 ? -10 : 0,
                              zIndex: assignedChildren.length - i,
                              flexShrink: 0,
                            }}
                          >
                            <ChildAvatar child={child} size={32} />
                          </div>
                        ))}
                        {assignedChildren.length > 3 && (
                          <div
                            className="flex items-center justify-center rounded-full"
                            style={{
                              width: 36, height: 36,
                              background: "rgba(79,195,247,0.2)",
                              border: "2.5px solid rgba(79,195,247,0.4)",
                              marginLeft: -10,
                              color: "#4fc3f7",
                              fontSize: 11,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            +{assignedChildren.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); isPickerOpen ? setPickerOpenId(null) : openPicker(entry.id, assignedChildIds); }}
                    className="block mx-auto px-3.5 py-1 rounded-full font-medium truncate transition-all active:scale-95"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(6px)",
                      color: "rgba(255,255,255,0.45)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "var(--fs-body)",
                    }}
                  >
                    {isAssigning ? "…" : "+ Assign"}
                  </button>
                )}

                {/* Multi-select child picker */}
                {isPickerOpen && (
                  <div
                    className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-20"
                    style={{ background: "#0D1120", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}
                  >
                    {children.map((child, i) => {
                      const selected = pendingSelections.includes(child.id);
                      return (
                        <button
                          key={child.id}
                          onClick={() => toggleChild(entry.id, child.id)}
                          className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 transition-all"
                          style={{
                            background: selected ? "rgba(79,195,247,0.1)" : "transparent",
                            borderBottom: i < children.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                          }}
                        >
                          <div
                            className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
                            style={{ width: 28, height: 28 }}
                          >
                            <ChildAvatar child={child} size={28} />
                          </div>
                          <span className="flex-1 truncate text-fs-body" style={{ color: selected ? "#4fc3f7" : "#fff" }}>{child.name}</span>
                          <div
                            className="flex-shrink-0 rounded flex items-center justify-center transition-all"
                            style={{
                              width: 18, height: 18,
                              background: selected ? "#4fc3f7" : "transparent",
                              border: selected ? "none" : "1.5px solid rgba(255,255,255,0.25)",
                            }}
                          >
                            {selected && <span style={{ color: "#040612", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                          </div>
                        </button>
                      );
                    })}
                    {/* Save / Clear row */}
                    <div className="flex gap-1.5 px-2 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      {pendingSelections.length > 0 && (
                        <button
                          onClick={() => setPickerSelections((prev) => ({ ...prev, [entry.id]: [] }))}
                          className="px-3 py-1.5 rounded-lg text-fs-body transition-all"
                          style={{ background: "rgba(236,72,153,0.1)", color: "rgba(236,72,153,0.8)", border: "1px solid rgba(236,72,153,0.2)" }}
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => saveAssignment(entry.id)}
                        className="flex-1 py-1.5 rounded-lg text-fs-body font-semibold transition-all active:scale-95"
                        style={{ background: "rgba(79,195,247,0.2)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.35)" }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Title + metadata — below the physical book */}
            <div className="px-2 pt-1.5">
              <p className="text-white text-fs-body font-bold leading-tight line-clamp-2">{entry.title}</p>
              {(entry.viewCount ?? 0) > 0 && (
                <p className="text-fs-body mt-0.5" style={{ color: "rgba(79,195,247,0.55)" }}>👁 {entry.viewCount}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// ─── NextStoriesButton — reveals the next page of an already-fetched,
// already-filtered list. Purely a client-side reveal (increases how many of
// the existing array are sliced into view) — not a new network fetch.
function NextStoriesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full py-3 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
    >
      Next stories →
    </button>
  );
}

// ─── FilterChipRow — labeled, horizontally-scrollable chip row with nav
// arrows. Used for both the mood/story-type row and the moral-lesson row in
// the advanced search panel below — previously just a bare overflow-x-auto
// div with no label (so it wasn't obvious what a row of chips was filtering
// by) and no way to tell or reach hidden content besides a raw touch-drag.
// Arrows only render on whichever side still has more to scroll to.
function FilterChipRow({ label, children }: { label: string; children: React.ReactNode }) {
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
  }, [updateArrows, children]);

  const scrollBy = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });

  const arrowStyle: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 2,
    width: 28, height: 28, borderRadius: "50%",
    background: "rgba(5,8,20,0.9)", border: "1px solid rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 700, lineHeight: 1,
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  };

  return (
    <div>
      <p className="text-fs-label font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(79,195,247,0.75)" }}>
        {label}
      </p>
      <div className="relative">
        {canScrollLeft && (
          <button onClick={() => scrollBy(-1)} aria-label="Scroll left" style={{ ...arrowStyle, left: -2 }}>‹</button>
        )}
        <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {children}
        </div>
        {canScrollRight && (
          <button onClick={() => scrollBy(1)} aria-label="Scroll right" style={{ ...arrowStyle, right: -2 }}>›</button>
        )}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { t, language } = useLanguage();
  const { effective } = useViewMode();
  const isMobile = effective === "mobile";

  const [activeTab, setActiveTab] = useState<LibraryTab>("my-stories");
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // A Draft card (unproduced-but-saved script, see includeDrafts) reopens
  // Studio at that exact script instead of the read-only story page — which
  // assumes real audio and a full script the lightweight list summary
  // doesn't carry, so the full entry is fetched fresh here first. Mirrors
  // library/[id]/page.tsx's own handleEdit "Open in Studio" mechanism.
  const handleOpenDraft = useCallback(async (draftId: string) => {
    try {
      const res = await fetch(`/api/library/${draftId}`);
      if (!res.ok) return;
      const entry = await res.json() as LibraryEntry;
      if (!("id" in entry)) return;
      writeDraft({
        promptText: "",
        scriptBlocks: entry.blocks,
        summary: entry.summary,
        coverPrompt: "",
        coverUrl: entry.coverUrl ?? "",
        coverFocusX: entry.coverFocusX,
        coverFocusY: entry.coverFocusY,
        editingStoryId: entry.id,
        storyTitle: entry.title,
        language: entry.language,
        audioUrl: entry.audioUrl,
        durationSeconds: entry.durationSeconds,
        moralLessons: entry.moralLessons,
        characterProfiles: entry.characterProfiles,
        scenes: entry.scenes,
      }, "nightstory_studio2_draft_v1");
      router.push("/studio?tab=script");
    } catch { /* stay on the Library card if this fails */ }
  }, [router]);

  useEffect(() => {
    // An explicit ?tab= from a deep link (e.g. Home's "View all" on a
    // specific rail) always wins over whatever tab this session last had
    // open — the whole point of that link is "take me to Classics", not
    // "take me wherever I happened to leave off".
    const tabParam = searchParams.get("tab");
    const validTabs: LibraryTab[] = ["all", "my-stories", "family", "classics", "community"];
    if (tabParam && (validTabs as string[]).includes(tabParam)) {
      setActiveTab(tabParam as LibraryTab);
    } else {
      const saved = sessionStorage.getItem("library-tab");
      if (saved === "classics" || saved === "community" || saved === "family" || saved === "all") setActiveTab(saved as LibraryTab);
    }
    const childId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
    setActiveChildId(childId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [children, setChildren] = useState<DBChildProfile[]>([]);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [familyEntries, setFamilyEntries] = useState<LibraryEntry[]>([]);
  const [allEntries, setAllEntries] = useState<LibraryEntry[]>([]);
  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [recentClassics, setRecentClassics] = useState<ClassicMeta[]>([]);
  const [communityStories, setCommunityStories] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [trashCount, setTrashCount] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [selectedLanguages, setSelectedLanguages] = useState<Set<Language>>(new Set());
  // How many of the active tab's (already-filtered) results are shown before
  // the "Next stories" button reveals another page — resets whenever the tab
  // or any filter changes, so switching context always starts back at the top.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, search, selectedMoods, selectedLessons, selectedLanguages]);
  // Filter chips/dropdown stay collapsed until the search bar is focused —
  // opened on focus, and kept open (rather than closing on blur) whenever
  // there's an active search/filter, so tapping a chip doesn't immediately
  // hide the row it's in.
  const [searchExpanded, setSearchExpanded] = useState(false);
  const recentScrollRef = useRef<HTMLDivElement>(null);
  const [recentCanScrollLeft, setRecentCanScrollLeft] = useState(false);
  const [recentCanScrollRight, setRecentCanScrollRight] = useState(false);

  const updateRecentScroll = () => {
    const el = recentScrollRef.current;
    if (!el) return;
    setRecentCanScrollLeft(el.scrollLeft > 4);
    setRecentCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scrollRecent = (dir: "left" | "right") => {
    const el = recentScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  };

  const applyClassics = (cls: ClassicMeta[]) => {
    setClassics(cls);
    setRecentClassics(cls.filter((c) => c.status === "ready").slice(0, 5));
  };

  // On mount: load classics, trash, all-family stories, and child profiles
  useEffect(() => {
    Promise.all([
      fetch("/api/library/trash?count=1", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/classics", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/child-profiles", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/community", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library?scope=all", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([trash, cls, allLib, kids, community, allVisible]) => {
        setTrashCount(typeof (trash as { count?: number })?.count === "number" ? (trash as { count: number }).count : 0);
        applyClassics(Array.isArray(cls) ? cls as ClassicMeta[] : []);
        const allArr = Array.isArray(allLib) ? allLib as LibraryEntry[] : [];
        setFamilyEntries(allArr);
        setAllEntries(Array.isArray(allVisible) ? allVisible as LibraryEntry[] : []);
        allArr.slice(0, 12).forEach((e) => { if (e.coverUrl) { new Image().src = e.coverUrl; } });
        setChildren(Array.isArray(kids) ? kids as DBChildProfile[] : []);
        if (Array.isArray(community)) setCommunityStories(community as typeof communityStories);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setTimeout(updateRecentScroll, 50); });
  }, []);

  // Re-fetch child-scoped stories whenever activeChildId changes
  useEffect(() => {
    if (activeChildId === null) return;
    const cacheKey = `library-cache-${activeChildId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setEntries(JSON.parse(cached) as LibraryEntry[]); }
    } catch {}
    // includeDrafts=1: My Stories is the one place an unproduced-but-saved
    // script should surface (as a Draft card) so "Save for later" in Studio
    // actually leads somewhere the user can find it again.
    fetch(`/api/library?childId=${encodeURIComponent(activeChildId)}&includeDrafts=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((lib) => {
        const arr = Array.isArray(lib) ? lib as LibraryEntry[] : [];
        setEntries(arr);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(arr)); } catch {}
      })
      .catch(() => {});
  }, [activeChildId]);

  const q = search.toLowerCase().trim();

  // One shared filter, structural enough to cover both LibraryEntry (My
  // Stories/All/Family/Community — all four now carry the same
  // character_profiles/scenes/moral_lessons via SEARCH_COLUMNS) and
  // ClassicMeta (tagline instead of summary; only populated once a classic
  // is actually generated). Text box also matches character names now, not
  // just title/summary — parents often remember "the fox story," not the title.
  type Searchable = {
    title: string;
    summary?: string;
    tagline?: string;
    characterProfiles?: Record<string, unknown>;
    scenes?: { primaryMood?: string }[];
    moralLessons?: { lesson: string }[];
    language?: string;
  };
  const matchesQuery = (item: Searchable) => {
    if (!q) return true;
    const text = `${item.title} ${item.summary ?? item.tagline ?? ""}`.toLowerCase();
    if (text.includes(q)) return true;
    return Object.keys(item.characterProfiles ?? {}).some((name) => name.toLowerCase().includes(q));
  };
  const matchesMood = (item: Searchable) => {
    if (selectedMoods.size === 0) return true;
    const mood = dominantMood(item);
    return mood !== undefined && selectedMoods.has(mood);
  };
  const matchesLessons = (item: Searchable) =>
    selectedLessons.size === 0 || (item.moralLessons ?? []).some((l) => selectedLessons.has(l.lesson));
  const matchesLanguage = (item: Searchable) =>
    selectedLanguages.size === 0 || (!!item.language && selectedLanguages.has(item.language as Language));
  const matchesFilters = (item: Searchable) =>
    matchesQuery(item) && matchesMood(item) && matchesLessons(item) && matchesLanguage(item);

  // One shared search bar + chip row now drives every tab's filtering —
  // My Stories/All/Family/Community/Classics all use the exact same
  // matchesFilters predicate against their own dataset.
  const filtered = dedupeBySeries(entries.filter(matchesFilters));
  const filteredAll = dedupeBySeries(allEntries.filter(matchesFilters));
  const filteredFamily = dedupeBySeries(familyEntries.filter(matchesFilters));
  const filteredCommunity = dedupeBySeries(communityStories.filter(matchesFilters));

  // Chip/dropdown options are the full canonical catalogs, not just whatever
  // happens to already be present in a loaded list — the same fixed
  // vocabularies used at generation time (7 moods, 10 lesson values, every
  // supported UI language), so every possible search facet is always
  // reachable regardless of which tab you're on.
  const lessonCatalog = getLessonsCatalog(language);
  const allLanguages = Object.entries(LANGUAGE_META) as [Language, typeof LANGUAGE_META[Language]][];

  const toggleMood = (id: string) => setSelectedMoods((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleLesson = (id: string) => setSelectedLessons((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleLanguage = (code: Language) => setSelectedLanguages((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const clearAllFilters = () => {
    setSearch("");
    setSelectedMoods(new Set());
    setSelectedLessons(new Set());
    setSelectedLanguages(new Set());
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/library/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTrashCount((c) => c + 1);
    } catch {
      // entry stays in list
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="cosmic-page min-h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-0">
        <div className="flex items-center justify-between mb-5">
          {activeTab === "my-stories" ? (
            <Link
              href="/library/trash"
              className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: "rgba(255,255,255,0.52)" }}
            >
              <Icon name="delete" size={18} />
              {trashCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-fs-body font-bold flex items-center justify-center"
                  style={{ background: "rgba(236,72,153,0.8)", color: "#fff" }}
                >
                  {trashCount > 9 ? "9+" : trashCount}
                </span>
              )}
            </Link>
          ) : (
            <div className="w-9" />
          )}

          <h1
            className="text-fs-heading font-light tracking-widest"
            style={{
              background: "linear-gradient(135deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 12px rgba(79,195,247,0.3))",
            }}
          >
            {t("library")}
          </h1>
          <div className="w-9" />
        </div>

        {/* Recently Played — spans both tabs */}
        {!loading && (entries.length > 0 || recentClassics.length > 0) && (
          <div className="mb-4">
            <p className="text-fs-body font-bold uppercase tracking-widest mb-2.5" style={{ color: "rgba(255,255,255,0.50)" }}>
              {t("recentlyPlayedSection")}
            </p>
            <div className="relative">
              {/* Left arrow */}
              {recentCanScrollLeft && (
                <button onClick={() => scrollRecent("left")}
                  className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 transition-opacity"
                  style={{ background: "linear-gradient(to right, rgba(4,6,18,0.85), transparent)" }}>
                  <span className="text-white/60 text-fs-heading">‹</span>
                </button>
              )}
              {/* Right arrow */}
              {recentCanScrollRight && (
                <button onClick={() => scrollRecent("right")}
                  className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 transition-opacity"
                  style={{ background: "linear-gradient(to left, rgba(4,6,18,0.85), transparent)" }}>
                  <span className="text-white/60 text-fs-heading">›</span>
                </button>
              )}
            <div ref={recentScrollRef} onScroll={updateRecentScroll}
              className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {[
                ...entries.slice(0, 3).map((e) => ({
                  key: `s-${e.id}`,
                  href: `/library/${e.id}`,
                  title: e.title,
                  coverUrl: e.coverUrl ?? null,
                })),
                ...recentClassics.slice(0, 3).map((c) => ({
                  key: `c-${c.id}`,
                  href: `/library/classics/${c.id}`,
                  title: c.title,
                  coverUrl: c.coverUrl ?? null,
                })),
              ].slice(0, 5).map((item) => {
                const [c1, c2] = cardPalette(item.title);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex-shrink-0 flex flex-col transition-all active:scale-[0.97] select-none"
                    style={{ width: 110, flexShrink: 0 }}
                  >
                    {/* Clean jacket — title lives below the book */}
                    <div className="relative w-full" style={{ height: 150 }}>
                      {item.coverUrl ? (
                        <StoryPoster coverUrl={item.coverUrl} alt={item.title} borderRadius={10} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-fs-display rounded-2xl overflow-hidden"
                          style={{ background: `linear-gradient(145deg,${c1}33,${c2}55)`, border: "1px solid rgba(255,255,255,0.07)" }}>
                          <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>🌙</span>
                        </div>
                      )}
                    </div>
                    <p className="text-white text-fs-body font-bold leading-tight line-clamp-2 tracking-wide mt-1.5 pr-1">{item.title}</p>
                  </Link>
                );
              })}
            </div>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 0 0" }} />
          </div>
        )}

        {/* Tab switcher — scrollable pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {([
            { key: "all",        label: t("all") },
            { key: "my-stories", label: t("myLibraryTab") },
            { key: "family",     label: "Family Stories" },
            { key: "classics",   label: t("classicsTab") },
            { key: "community",  label: t("communityTab") },
          ] as { key: LibraryTab; label: string }[]).map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(key); sessionStorage.setItem("library-tab", key); }}
                className="flex-shrink-0 px-4 py-2 rounded-full text-fs-body font-medium tracking-wide transition-all"
                style={active
                  ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search — ONE shared bar for every tab. Mood/lesson/language chips
            stay collapsed until the bar is focused (or a filter is already
            active), then expand below it. onMouseDown/preventDefault on the
            chip row stops the input from blurring (and the row from
            collapsing) when a chip is tapped. */}
        <div className="relative mb-3">
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fs-body pointer-events-none"
            style={{ color: "rgba(255,255,255,0.48)" }}
          >
            <Icon name="search" size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchExpanded(true)}
            onBlur={() => setSearchExpanded(false)}
            placeholder={t("search")}
            className="w-full pl-9 pr-9 py-2.5 rounded-2xl text-fs-body text-white placeholder-white/20 outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          />
          {search && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 hover:text-white/60 transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {(searchExpanded || search || selectedMoods.size > 0 || selectedLessons.size > 0 || selectedLanguages.size > 0) && (
          <div
            className="flex flex-col gap-2 mb-3"
            onMouseDown={(e) => e.preventDefault()}
          >
            <FilterChipRow label="Mood">
              {MOODS.map((m) => {
                const active = selectedMoods.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMood(m.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                    style={active
                      ? { background: `${m.color}26`, border: `1px solid ${m.color}66`, color: m.color }
                      : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.55)" }}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.id}</span>
                  </button>
                );
              })}
            </FilterChipRow>

            <FilterChipRow label="Moral lesson">
              {lessonCatalog.map((l) => {
                const active = selectedLessons.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLesson(l.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                    style={active
                      ? { background: "rgba(139,92,246,0.16)", border: "1px solid rgba(139,92,246,0.45)", color: "#c4b5fd" }
                      : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.55)" }}
                  >
                    <Icon name={l.icon} size={13} />
                    <span>{l.label}</span>
                  </button>
                );
              })}
            </FilterChipRow>

            <FilterChipRow label="Language">
              {allLanguages.map(([code, meta]) => {
                const active = selectedLanguages.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggleLanguage(code)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                    style={active
                      ? { background: "rgba(79,195,247,0.16)", border: "1px solid rgba(79,195,247,0.45)", color: "#4fc3f7" }
                      : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.55)" }}
                  >
                    <span>{meta.flag}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </FilterChipRow>
          </div>
        )}
      </div>

      <div className="px-4 pb-32">
        {/* ── Classics tab — keep mounted to avoid re-fetching on every tab switch ── */}
        <div style={{ display: activeTab === "classics" ? undefined : "none" }}>
          <ClassicsTab
            classics={classics}
            loading={loading}
            onClassicUpdated={(updated) => setClassics((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
            matchesFilter={matchesFilters}
          />
        </div>

        {/* ── All Stories tab — this family's own stories plus every public
             story (classics, community, any family's stories once public).
             Read-only browsing (no delete/assign) since it mixes in stories
             that aren't necessarily this family's to manage. ── */}
        {activeTab === "all" && (
          loading ? (
            <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)", aspectRatio: "2/3", animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          ) : allEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🌙</span>
              <p className="text-white/40 text-fs-body font-light tracking-wide">{t("noStories")}</p>
            </div>
          ) : filteredAll.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
              <p className="text-white/40 text-fs-body">{t("noStoriesFilter")}</p>
              <button
                onClick={clearAllFilters}
                className="text-fs-body px-4 py-2 rounded-full transition-all"
                style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)" }}
              >
                {t("clearFilters")}
              </button>
            </div>
          ) : (
            <>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: effective === "desktop" ? "repeat(4, 1fr)" : "repeat(3, 1fr)" }}
            >
              {filteredAll.slice(0, visibleCount).map((entry) => {
                const [c1, c2] = cardPalette(entry.title);
                const isSeries = !!entry.chapterCount && entry.chapterCount > 1;
                const displayTitle = isSeries ? seriesDisplayTitle(entry.title) : entry.title;
                const duration = formatDuration(entry.durationSeconds);
                const langCode = entry.language?.slice(0, 2).toUpperCase();

                return (
                  <div key={entry.id} className="flex flex-col rounded-xl transition-all select-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <Link href={entry.isClassic ? `/library/classics/${entry.id}` : `/library/${entry.id}`} className="relative w-full active:opacity-80 transition-opacity p-1" style={{ aspectRatio: "2/3" }}>
                      {entry.coverUrl ? (
                        <StoryPoster coverUrl={entry.coverUrl} alt={displayTitle} borderRadius={8} />
                      ) : (
                        <div className="absolute inset-1 flex items-center justify-center text-fs-display rounded-lg overflow-hidden"
                          style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}55)` }}>
                          <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>{entry.isClassic ? "✨" : "🌙"}</span>
                        </div>
                      )}
                      {entry.isPublic && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-fs-caption font-bold uppercase tracking-wide"
                          style={{ background: "rgba(4,6,18,0.75)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>
                          {entry.isClassic ? t("classicBadge") : t("communityTab")}
                        </span>
                      )}
                    </Link>
                    <div className="flex items-start gap-1 px-2 pt-2 pb-2.5">
                      <div className="flex-1 min-w-0">
                        <Link href={entry.isClassic ? `/library/classics/${entry.id}` : `/library/${entry.id}`}>
                          <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{displayTitle}</p>
                        </Link>
                        <div className="flex items-center gap-1 mt-1">
                          {duration && (
                            <span className="text-fs-caption tracking-wide"
                              style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.4)" }}>
                              {duration}
                            </span>
                          )}
                          {langCode && (
                            <span className="text-fs-caption font-semibold tracking-wide"
                              style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.4)" }}>
                              {langCode}
                            </span>
                          )}
                          {isSeries && <span className="ml-auto"><SeriesCountBadge count={entry.chapterCount!} size="sm" /></span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredAll.length > visibleCount && (
              <NextStoriesButton onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} />
            )}
            </>
          )
        )}

        {/* ── Family Stories tab ── */}
        {activeTab === "family" && (
          loading ? (
            <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)", aspectRatio: "2/3", animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          ) : familyEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
              <span className="text-5xl" style={{ filter: "drop-shadow(0 0 20px rgba(167,139,250,0.4))" }}>👨‍👩‍👧‍👦</span>
              <p className="text-white/40 text-fs-body font-light tracking-wide">No family stories yet</p>
              <p className="text-white/40 text-fs-body">Stories created for any child will appear here</p>
            </div>
          ) : filteredFamily.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
              <p className="text-white/40 text-fs-body">{t("noStoriesFilter")}</p>
              <button
                onClick={clearAllFilters}
                className="text-fs-body px-4 py-2 rounded-full transition-all"
                style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)" }}
              >
                {t("clearFilters")}
              </button>
            </div>
          ) : (
            <>
            <FamilyStoriesGrid
              entries={filteredFamily.slice(0, visibleCount)}
              children={children}
              effective={effective}
              onAssigned={(storyId, childIds) =>
                setFamilyEntries((prev) =>
                  prev.map((e) => e.id === storyId ? { ...e, childIds: childIds.length ? childIds : undefined } : e)
                )
              }
            />
            {filteredFamily.length > visibleCount && (
              <NextStoriesButton onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} />
            )}
            </>
          )
        )}

        {/* ── Community tab ── */}
        {activeTab === "community" && (
          communityStories.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
              <span className="text-5xl" style={{ filter: "drop-shadow(0 0 24px rgba(167,139,250,0.5))" }}>🌍</span>
              <p className="text-white/50 text-fs-body font-medium tracking-wide">{t("communityStories")}</p>
              <p className="text-white/48 text-fs-body max-w-[220px] leading-relaxed">{t("communityStoriesSoon")}</p>
            </div>
          ) : filteredCommunity.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
              <p className="text-white/40 text-fs-body">{t("noStoriesFilter")}</p>
              <button
                onClick={clearAllFilters}
                className="text-fs-body px-4 py-2 rounded-full transition-all"
                style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)" }}
              >
                {t("clearFilters")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-fs-body px-1" style={{ color: "rgba(255,255,255,0.50)" }}>
                🌍 Stories made with NightStory
              </p>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                {filteredCommunity.slice(0, visibleCount).map((s) => (
                  <a key={s.id} href={`/library/${s.id}`}
                    className="flex flex-col rounded-2xl transition-all active:scale-[0.97]"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ position: "relative", paddingBottom: "100%", background: "rgba(167,139,250,0.08)" }}>
                      {s.coverUrl
                        ? <div style={{ position: "absolute", inset: 4 }}><StoryPoster coverUrl={s.coverUrl} alt={s.title} borderRadius={8} /></div>
                        : <div className="absolute inset-0 flex items-center justify-center text-3xl rounded-lg overflow-hidden">{s.emoji ?? "🌙"}</div>
                      }
                    </div>
                    <div className="p-2">
                      <p className="text-white font-medium leading-tight" style={{ fontSize: "var(--fs-label)" }}>{s.title}</p>
                    </div>
                  </a>
                ))}
              </div>
              {filteredCommunity.length > visibleCount && (
                <NextStoriesButton onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} />
              )}
            </div>
          )
        )}

        {/* ── My Stories tab ── */}
        {activeTab === "my-stories" && (
          loading ? (
            <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)", aspectRatio: "2/3", animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
              <span className="text-5xl" style={{ filter: "drop-shadow(0 0 20px rgba(79,195,247,0.4))" }}>🌙</span>
              <p className="text-white/40 text-fs-body font-light tracking-wide">{t("noStories")}</p>
              <p className="text-white/40 text-fs-body">{t("createFirstStory")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
              <p className="text-white/40 text-fs-body">{t("noStoriesFilter")}</p>
              <button
                onClick={clearAllFilters}
                className="text-fs-body px-4 py-2 rounded-full transition-all"
                style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)" }}
              >
                {t("clearFilters")}
              </button>
            </div>
          ) : (
            <>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: effective === "desktop" ? "repeat(4, 1fr)" : effective === "tablet" ? "repeat(3, 1fr)" : "repeat(3, 1fr)" }}
            >
              {filtered.slice(0, visibleCount).map((entry) => {
                const isConfirming = confirmingId === entry.id;
                const isDeleting = deletingId === entry.id;
                const [c1, c2] = cardPalette(entry.title);

                if (isConfirming) {
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl overflow-hidden col-span-3 transition-all"
                      style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.35)" }}
                    >
                      <div className="flex flex-col gap-3 px-4 py-4">
                        <p className="text-fs-body text-white/70">
                          {t("moveToTrash")} <span className="text-white font-medium">"{entry.title}"</span>?
                        </p>
                        <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.52)" }}>{t("keptFor30Days")}</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmingId(null)} className="flex-1 py-2.5 rounded-xl text-fs-body transition-all active:scale-[0.98]"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                            {t("cancel")}
                          </button>
                          <button onClick={() => handleDeleteConfirm(entry.id)} disabled={isDeleting}
                            className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
                            style={{ background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.4)", color: "#EC4899" }}>
                            {isDeleting ? "…" : t("moveToTrash")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isSeries = !!entry.chapterCount && entry.chapterCount > 1;
                const displayTitle = isSeries ? seriesDisplayTitle(entry.title) : entry.title;
                const duration = formatDuration(entry.durationSeconds);
                const langCode = entry.language?.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col rounded-xl transition-all select-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", opacity: isDeleting ? 0.4 : 1, transition: "opacity 0.2s" }}
                  >
                    {/* Image — a couple px of padding gives the 3D book's
                        spine/page slivers room to peek without hitting this
                        card's own rounded corners. A Draft (script saved,
                        no audio yet) reopens Studio instead of the read-only
                        story page, which assumes real audio to exist. */}
                    {entry.isDraft ? (
                      <div
                        role="button" tabIndex={0}
                        onClick={() => handleOpenDraft(entry.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleOpenDraft(entry.id); }}
                        className="relative w-full active:opacity-80 transition-opacity p-1 cursor-pointer"
                        style={{ aspectRatio: "2/3" }}
                      >
                        {entry.coverUrl ? (
                          <StoryPoster coverUrl={entry.coverUrl} alt={displayTitle} borderRadius={8} />
                        ) : (
                          <div className="absolute inset-1 flex items-center justify-center text-fs-display rounded-lg overflow-hidden"
                            style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}55)` }}>
                            <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>📝</span>
                          </div>
                        )}
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-fs-caption font-bold uppercase tracking-wide"
                          style={{ background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", backdropFilter: "blur(4px)" }}>
                          Draft
                        </span>
                      </div>
                    ) : (
                      <Link href={`/library/${entry.id}`} className="relative w-full active:opacity-80 transition-opacity p-1" style={{ aspectRatio: "2/3" }}>
                        {entry.coverUrl ? (
                          <StoryPoster coverUrl={entry.coverUrl} alt={displayTitle} borderRadius={8} />
                        ) : (
                          <div className="absolute inset-1 flex items-center justify-center text-fs-display rounded-lg overflow-hidden"
                            style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}55)` }}>
                            <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>🌙</span>
                          </div>
                        )}
                      </Link>
                    )}

                    {/* Info row */}
                    <div className="flex items-start gap-1 px-2 pt-2 pb-2.5">
                      <div className="flex-1 min-w-0">
                        {entry.isDraft ? (
                          <button onClick={() => handleOpenDraft(entry.id)} className="text-left w-full">
                            <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{displayTitle}</p>
                          </button>
                        ) : (
                          <Link href={`/library/${entry.id}`}>
                            <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{displayTitle}</p>
                          </Link>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {duration && (
                            <span className="text-fs-caption tracking-wide"
                              style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.4)" }}>
                              {duration}
                            </span>
                          )}
                          {langCode && (
                            <span className="text-fs-caption font-semibold tracking-wide"
                              style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.4)" }}>
                              {langCode}
                            </span>
                          )}
                          {isSeries && <span className="ml-auto"><SeriesCountBadge count={entry.chapterCount!} size="sm" /></span>}
                        </div>
                      </div>
                      <button onClick={() => setConfirmingId(entry.id)}
                        className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-full transition-opacity active:opacity-50 mt-0.5"
                        style={{ color: "rgba(255,255,255,0.40)" }} aria-label="Delete story">
                        <Icon name="delete" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > visibleCount && (
              <NextStoriesButton onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} />
            )}
            </>
          )
        )}
      </div>

      {/* FAB — only on My Stories tab */}
      {activeTab === "my-stories" && (
        <Link
          href="/studio"
          className="fixed w-14 h-14 rounded-2xl flex items-center justify-center text-white text-fs-title font-light z-40 active:scale-95 transition-transform"
          style={{
            bottom: isMobile ? 96 : 32,
            right: isMobile ? 16 : 32,
            background: "linear-gradient(135deg, rgba(79,195,247,0.3), rgba(79,195,247,0.12))",
            border: "1px solid rgba(79,195,247,0.4)",
            boxShadow: "0 4px 24px rgba(79,195,247,0.25)",
            backdropFilter: "blur(12px)",
          }}
        >
          ✦
        </Link>
      )}
    </div>
  );
}
