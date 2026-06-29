"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode } from "@/context/ViewModeContext";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { ClassicMeta } from "@/lib/classicStories";
import { LANGUAGE_META } from "@/lib/i18n";
import Icon from "@/components/ui/Icon";

function timeAgo(ts: number, tFn: (key: string) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tFn("justNow");
  if (mins < 60) return `${mins}${tFn("minutesAgo")}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${tFn("hoursAgo")}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return tFn("yesterday");
  return `${days}${tFn("daysAgo")}`;
}

function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m <= 1 ? "1 min" : `${m} min`;
}

type DurationFilter = "all" | "short" | "medium" | "long";

function getDurationFilters(tFn: (key: string) => string): { key: DurationFilter; label: string; icon: string }[] {
  return [
    { key: "all",    label: tFn("all"),    icon: "✦" },
    { key: "short",  label: tFn("short"),  icon: "⚡" },
    { key: "medium", label: tFn("medium"), icon: "🌙" },
    { key: "long",   label: tFn("long"),   icon: "📖" },
  ];
}

function matchesDuration(seconds: number, filter: DurationFilter): boolean {
  if (filter === "all") return true;
  const m = seconds / 60;
  if (filter === "short")  return m < 3;
  if (filter === "medium") return m >= 3 && m < 8;
  if (filter === "long")   return m >= 8;
  return true;
}

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

// ── Classics tab ─────────────────────────────────────────────────────────────

function ClassicsTab({ classics, loading, onClassicUpdated }: {
  classics: ClassicMeta[];
  loading: boolean;
  onClassicUpdated: (updated: ClassicMeta) => void;
}) {
  const { effective } = useViewMode();
  const { t } = useLanguage();

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  const q = search.toLowerCase().trim();
  const filtered = classics.filter(
    (c) => !q || c.title.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q)
  );

  return (
    <div className="pt-2">
      {/* Search bar */}
      <div className="relative mb-3">
        <span
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fs-body pointer-events-none"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchClassics")}
          className="w-full pl-9 pr-9 py-2.5 rounded-2xl text-fs-body text-white placeholder-white/20 outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-16 gap-3 text-center">
          <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
          <p className="text-white/40 text-fs-body">{t("noClassicsMatch")}</p>
          <button
            onClick={() => setSearch("")}
            className="text-fs-body px-4 py-2 rounded-full transition-all"
            style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)" }}
          >
            {t("clearSearch")}
          </button>
        </div>
      )}

    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: effective === "desktop" ? "repeat(4, 1fr)" : effective === "tablet" ? "repeat(3, 1fr)" : "repeat(3, 1fr)" }}
    >
      {filtered.map((meta) => {
        const isGenerating = generatingId === meta.id;
        const [c1, c2] = cardPalette(meta.title);

        return (
          <Link
            key={meta.id}
            href={`/library/classics/${meta.id}`}
            className="flex flex-col rounded-xl overflow-hidden transition-all active:scale-[0.97] select-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Image */}
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "2/3" }}>
              {meta.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.coverUrl} alt={meta.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-fs-display"
                  style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}55)` }}>
                  <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>
                    {isGenerating ? "✨" : meta.emoji}
                  </span>
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: "rgba(5,8,20,0.55)", backdropFilter: "blur(4px)" }}>
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${c1} transparent transparent transparent` }} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="px-2 pt-2 pb-2.5">
              <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{meta.title}</p>
              <p className="text-white/40 text-fs-body mt-0.5 leading-snug line-clamp-1">{meta.tagline}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {meta.durationSeconds ? (
                  <span className="text-fs-body font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                    style={{ background: `${c1}18`, border: `1px solid ${c1}44`, color: c1 }}>
                    {durationLabel(meta.durationSeconds)}
                  </span>
                ) : meta.status === "pending" ? (
                  <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>{t("pending")}</span>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
    </div>
  );
}

// ── Main Library page ─────────────────────────────────────────────────────────

type LibraryTab = "my-stories" | "classics" | "community";

export default function LibraryPage() {
  const { t } = useLanguage();
  const { effective } = useViewMode();
  const isMobile = effective === "mobile";

  const [activeTab, setActiveTab] = useState<LibraryTab>("my-stories");

  useEffect(() => {
    const saved = sessionStorage.getItem("library-tab");
    if (saved === "classics" || saved === "community") setActiveTab(saved);
  }, []);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [recentClassics, setRecentClassics] = useState<ClassicMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [trashCount, setTrashCount] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
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

  const applyData = (lib: LibraryEntry[], trash: unknown[], cls: ClassicMeta[]) => {
    setEntries(lib);
    setTrashCount(trash.length);
    setClassics(cls);
    const ready = cls.filter((c) => c.status === "ready");
    setRecentClassics(ready.slice(0, 5));
  };

  useEffect(() => {
    // Show cached data instantly, then refresh in background
    try {
      const cached = sessionStorage.getItem("library-cache");
      if (cached) {
        const { lib, trash, cls } = JSON.parse(cached);
        applyData(lib, trash, cls);
        setLoading(false);
      }
    } catch {}

    Promise.all([
      fetch("/api/library", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library/trash", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/classics", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([lib, trash, cls]) => {
        const libArr = Array.isArray(lib) ? lib as LibraryEntry[] : [];
        const trashArr = Array.isArray(trash) ? trash as unknown[] : [];
        const clsArr = Array.isArray(cls) ? cls as ClassicMeta[] : [];
        applyData(libArr, trashArr, clsArr);
        try { sessionStorage.setItem("library-cache", JSON.stringify({ lib: libArr, trash: trashArr, cls: clsArr })); } catch {}
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setTimeout(updateRecentScroll, 50); });
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = entries.filter((e) => {
    const matchesSearch = !q || e.title.toLowerCase().includes(q) || (e.summary ?? "").toLowerCase().includes(q);
    return matchesSearch && matchesDuration(e.durationSeconds, durationFilter);
  });

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
              style={{ color: "rgba(255,255,255,0.3)" }}
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
            <p className="text-fs-body font-bold uppercase tracking-widest mb-2.5" style={{ color: "rgba(255,255,255,0.28)" }}>
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
                  duration: durationLabel(e.durationSeconds),
                })),
                ...recentClassics.slice(0, 3).map((c) => ({
                  key: `c-${c.id}`,
                  href: `/library/classics/${c.id}`,
                  title: c.title,
                  coverUrl: c.coverUrl ?? null,
                  duration: durationLabel(c.durationSeconds ?? 0),
                })),
              ].slice(0, 5).map((item) => {
                const [c1, c2] = cardPalette(item.title);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex-shrink-0 rounded-2xl overflow-hidden transition-all active:scale-[0.97] relative select-none"
                    style={{ width: 110, height: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}
                  >
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.coverUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-fs-display"
                        style={{ background: `linear-gradient(145deg,${c1}33,${c2}55)` }}>
                        <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>🌙</span>
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(4,6,18,0.97) 100%)" }} />
                    <span className="absolute top-2 right-2 text-fs-body font-bold tracking-widest px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(4,6,18,0.72)", backdropFilter: "blur(6px)", color: c1, border: `1px solid ${c1}55` }}>
                      {item.duration}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-5">
                      <p className="text-white text-fs-body font-bold leading-tight line-clamp-2 tracking-wide">{item.title}</p>
                    </div>
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
            { key: "my-stories", label: t("myLibraryTab") },
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
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* My Stories filters */}
        {activeTab === "my-stories" && (
          <>
            <div className="relative mb-3" style={{ display: entries.length > 0 || search ? "block" : "none" }}>
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fs-body pointer-events-none"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                className="w-full pl-9 pr-9 py-2.5 rounded-2xl text-fs-body text-white placeholder-white/20 outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>

          </>
        )}
      </div>

      <div className="px-4 pb-32">
        {/* ── Classics tab — keep mounted to avoid re-fetching on every tab switch ── */}
        <div style={{ display: activeTab === "classics" ? undefined : "none" }}>
          <ClassicsTab
            classics={classics}
            loading={loading}
            onClassicUpdated={(updated) => setClassics((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
          />
        </div>

        {/* ── Community tab ── */}
        {activeTab === "community" && (
          <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
            <span className="text-5xl" style={{ filter: "drop-shadow(0 0 24px rgba(167,139,250,0.5))" }}>🌍</span>
            <p className="text-white/50 text-fs-body font-medium tracking-wide">{t("communityStories")}</p>
            <p className="text-white/25 text-fs-body max-w-[220px] leading-relaxed">{t("communityStoriesSoon")}</p>
          </div>
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
              <p className="text-white/20 text-fs-body">{t("createFirstStory")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
              <p className="text-white/40 text-fs-body">{t("noStoriesFilter")}</p>
              <button
                onClick={() => { setSearch(""); setDurationFilter("all"); }}
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
              {filtered.map((entry) => {
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
                        <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>{t("keptFor30Days")}</p>
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

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col rounded-xl overflow-hidden transition-all select-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", opacity: isDeleting ? 0.4 : 1, transition: "opacity 0.2s" }}
                  >
                    {/* Image */}
                    <Link href={`/library/${entry.id}`} className="relative w-full overflow-hidden active:opacity-80 transition-opacity" style={{ aspectRatio: "2/3" }}>
                      {entry.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.coverUrl} alt={entry.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-fs-display"
                          style={{ background: `linear-gradient(145deg, ${c1}33, ${c2}55)` }}>
                          <span style={{ filter: `drop-shadow(0 0 14px ${c1}aa)` }}>🌙</span>
                        </div>
                      )}
                      {/* Duration badge — overlaid on image, matching Recently Played style */}
                      <span className="absolute top-2 right-2 text-fs-body font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(4,6,18,0.72)", backdropFilter: "blur(6px)", color: c1, border: `1px solid ${c1}55` }}>
                        {durationLabel(entry.durationSeconds)}
                      </span>
                    </Link>

                    {/* Info row */}
                    <div className="flex items-start gap-1 px-2 pt-2 pb-2.5">
                      <div className="flex-1 min-w-0">
                        <Link href={`/library/${entry.id}`}>
                          <p className="text-white text-fs-body font-bold leading-snug line-clamp-2 tracking-wide">{entry.title}</p>
                        </Link>
                        <div className="flex items-center gap-1.5 mt-1">
                          {entry.language && LANGUAGE_META[entry.language as keyof typeof LANGUAGE_META] && (
                            <span className="text-fs-body" title={LANGUAGE_META[entry.language as keyof typeof LANGUAGE_META].label}>
                              {LANGUAGE_META[entry.language as keyof typeof LANGUAGE_META].flag}
                            </span>
                          )}
                          <span className="text-white/20 text-fs-body">{timeAgo(entry.createdAt, t)}</span>
                        </div>
                      </div>
                      <button onClick={() => setConfirmingId(entry.id)}
                        className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-full transition-opacity active:opacity-50 mt-0.5"
                        style={{ color: "rgba(255,255,255,0.2)" }} aria-label="Delete story">
                        <Icon name="delete" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
