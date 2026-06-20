"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode } from "@/context/ViewModeContext";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { ClassicMeta } from "@/lib/classicStories";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m <= 1 ? "1 min" : `${m} min`;
}

type DurationFilter = "all" | "short" | "medium" | "long";

const DURATION_FILTERS: { key: DurationFilter; label: string; icon: string }[] = [
  { key: "all",    label: "All",    icon: "✦" },
  { key: "short",  label: "Short",  icon: "⚡" },
  { key: "medium", label: "Medium", icon: "🌙" },
  { key: "long",   label: "Long",   icon: "📖" },
];

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

function ClassicsTab() {
  const { effective } = useViewMode();
  const isMobile = effective === "mobile";

  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const seedingRef = useRef(false);

  useEffect(() => {
    fetch("/api/classics", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClassics(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
            setClassics((prev) =>
              prev.map((item) => (item.id === c.id ? meta : item))
            );
          }
        } catch {
          // keep as pending, retry on next load
        }
      }
      setGeneratingId(null);
      seedingRef.current = false;
    })();
  }, [loading, classics]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-3xl animate-pulse"
            style={{ background: "rgba(255,255,255,0.04)", animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={isMobile ? "flex flex-col gap-3 pt-2" : "grid gap-4 pt-2"}
      style={isMobile ? undefined : { gridTemplateColumns: effective === "desktop" ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}
    >
      {classics.map((meta) => {
        const isGenerating = generatingId === meta.id;
        const [c1, c2] = cardPalette(meta.title);

        return (
          <Link
            key={meta.id}
            href={`/library/classics/${meta.id}`}
            className="rounded-3xl overflow-hidden transition-all active:opacity-70"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 2px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-stretch">
              {/* Thumbnail */}
              <div
                className="w-20 flex-shrink-0 self-stretch relative overflow-hidden"
                style={{ minHeight: 80 }}
              >
                {meta.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.coverUrl}
                    alt={meta.title}
                    className="w-full h-full object-cover"
                    style={{ minHeight: 80 }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-3xl"
                    style={{ background: `linear-gradient(145deg, ${c1}22, ${c2}33)`, minHeight: 80 }}
                  >
                    <span style={{ filter: `drop-shadow(0 0 10px ${c1}88)` }}>
                      {isGenerating ? "✨" : meta.emoji}
                    </span>
                  </div>
                )}

                {/* Generating overlay */}
                {isGenerating && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: "rgba(5,8,20,0.65)", backdropFilter: "blur(4px)" }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${c1} transparent transparent transparent` }}
                    />
                  </div>
                )}

                {/* Gradient fade to card bg */}
                <div
                  className="absolute inset-y-0 right-0 w-8 pointer-events-none"
                  style={{ background: "linear-gradient(to right, transparent, rgba(10,12,24,0.92))" }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 px-3 py-3.5">
                <div
                  className="w-8 h-0.5 rounded-full mb-2"
                  style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                />
                <p className="text-white text-sm font-semibold truncate leading-snug tracking-wide">
                  {meta.title}
                </p>
                <p className="text-white/38 text-xs truncate mt-0.5 leading-snug">
                  {meta.tagline}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {meta.durationSeconds && (
                    <span
                      className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${c1}22, ${c2}22)`,
                        border: `1px solid ${c1}44`,
                        color: c1,
                      }}
                    >
                      {durationLabel(meta.durationSeconds)}
                    </span>
                  )}
                  {isGenerating && (
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                      Generating…
                    </span>
                  )}
                  {meta.status === "pending" && !isGenerating && (
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Main Library page ─────────────────────────────────────────────────────────

type LibraryTab = "my-stories" | "classics";

export default function LibraryPage() {
  const { t } = useLanguage();
  const { effective } = useViewMode();
  const isMobile = effective === "mobile";

  const [activeTab, setActiveTab] = useState<LibraryTab>(() => {
    if (typeof window === "undefined") return "my-stories";
    const saved = sessionStorage.getItem("library-tab");
    return saved === "classics" ? "classics" : "my-stories";
  });
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [trashCount, setTrashCount] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/library", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library/trash", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([lib, trash]) => {
        setEntries(Array.isArray(lib) ? lib : []);
        setTrashCount(Array.isArray(trash) ? trash.length : 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
              <span className="text-base">🗑</span>
              {trashCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
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
            className="text-lg font-light tracking-widest"
            style={{
              background: "linear-gradient(135deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 12px rgba(79,195,247,0.3))",
            }}
          >
            {t("myStories")}
          </h1>
          <div className="w-9" />
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1.5 mb-4 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["my-stories", "classics"] as LibraryTab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); sessionStorage.setItem("library-tab", tab); }}
                className="flex-1 py-2 rounded-xl text-xs font-medium tracking-wide transition-all"
                style={active
                  ? {
                      background: "rgba(79,195,247,0.15)",
                      border: "1px solid rgba(79,195,247,0.35)",
                      color: "#4fc3f7",
                    }
                  : {
                      background: "transparent",
                      border: "1px solid transparent",
                      color: "rgba(255,255,255,0.28)",
                    }
                }
              >
                {tab === "my-stories" ? "My Stories" : "✨ Classics"}
              </button>
            );
          })}
        </div>

        {/* My Stories filters */}
        {activeTab === "my-stories" && (
          <>
            <div className="relative mb-3" style={{ display: entries.length > 0 || search ? "block" : "none" }}>
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stories…"
                className="w-full pl-9 pr-9 py-2.5 rounded-2xl text-sm text-white placeholder-white/20 outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-base leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {entries.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {DURATION_FILTERS.map(({ key, label, icon }) => {
                  const active = durationFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setDurationFilter(key)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all"
                      style={{
                        background: active ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.04)",
                        border: active ? "1px solid rgba(79,195,247,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        color: active ? "#4fc3f7" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  );
                })}
                {entries.length > 0 && (
                  <span
                    className="flex items-center px-3 py-1.5 rounded-full text-xs flex-shrink-0"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                  >
                    {filtered.length} {filtered.length === 1 ? "story" : "stories"}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-32">
        {/* ── Classics tab ── */}
        {activeTab === "classics" && <ClassicsTab />}

        {/* ── My Stories tab ── */}
        {activeTab === "my-stories" && (
          loading ? (
            <div className="flex flex-col gap-3 pt-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-3xl animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)", animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
              <span className="text-5xl" style={{ filter: "drop-shadow(0 0 20px rgba(79,195,247,0.4))" }}>🌙</span>
              <p className="text-white/40 text-sm font-light tracking-wide">{t("noStories")}</p>
              <p className="text-white/20 text-xs">{t("createFirstStory")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
              <span className="text-4xl" style={{ filter: "drop-shadow(0 0 16px rgba(79,195,247,0.3))" }}>🔭</span>
              <p className="text-white/40 text-sm">No stories match your filter</p>
              <button
                onClick={() => { setSearch(""); setDurationFilter("all"); }}
                className="text-xs px-4 py-2 rounded-full transition-all"
                style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)" }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              className={isMobile ? "flex flex-col gap-3" : "grid gap-4"}
              style={isMobile ? undefined : { gridTemplateColumns: effective === "desktop" ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}
            >
              {filtered.map((entry) => {
                const isConfirming = confirmingId === entry.id;
                const isDeleting = deletingId === entry.id;
                const [c1, c2] = cardPalette(entry.title);

                return (
                  <div
                    key={entry.id}
                    className="rounded-3xl overflow-hidden transition-all"
                    style={{
                      background: isConfirming
                        ? "rgba(236,72,153,0.06)"
                        : "rgba(255,255,255,0.04)",
                      border: isConfirming
                        ? "1px solid rgba(236,72,153,0.35)"
                        : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isConfirming
                        ? "none"
                        : `0 2px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
                      backdropFilter: "blur(16px)",
                      opacity: isDeleting ? 0.4 : 1,
                      transition: "opacity 0.2s, border-color 0.2s",
                    }}
                  >
                    {isConfirming ? (
                      <div className="flex flex-col gap-3 px-4 py-4">
                        <p className="text-sm text-white/70">
                          {t("moveToTrash")} <span className="text-white font-medium">"{entry.title}"</span>?
                        </p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {t("keptFor30Days")}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="flex-1 py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {t("cancel")}
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(entry.id)}
                            disabled={isDeleting}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                            style={{
                              background: "rgba(236,72,153,0.15)",
                              border: "1px solid rgba(236,72,153,0.4)",
                              color: "#EC4899",
                            }}
                          >
                            {isDeleting ? "…" : t("moveToTrash")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-stretch">
                        <Link
                          href={`/library/${entry.id}`}
                          className="flex-1 flex items-center gap-0 active:opacity-70 transition-opacity min-w-0"
                        >
                          <div
                            className="w-20 flex-shrink-0 self-stretch relative overflow-hidden"
                            style={{ minHeight: 80 }}
                          >
                            {entry.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={entry.coverUrl}
                                alt={entry.title}
                                className="w-full h-full object-cover"
                                style={{ minHeight: 80 }}
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-3xl"
                                style={{
                                  background: `linear-gradient(145deg, ${c1}22, ${c2}33)`,
                                  minHeight: 80,
                                }}
                              >
                                <span style={{ filter: `drop-shadow(0 0 10px ${c1}88)` }}>🌙</span>
                              </div>
                            )}
                            <div
                              className="absolute inset-y-0 right-0 w-8 pointer-events-none"
                              style={{ background: `linear-gradient(to right, transparent, rgba(10,12,24,0.92))` }}
                            />
                          </div>

                          <div className="flex-1 min-w-0 px-3 py-3.5">
                            <div
                              className="w-8 h-0.5 rounded-full mb-2"
                              style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                            />
                            <p className="text-white text-sm font-semibold truncate leading-snug tracking-wide">
                              {entry.title}
                            </p>
                            <p className="text-white/38 text-xs truncate mt-0.5 leading-snug">
                              {entry.summary}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                                style={{
                                  background: `linear-gradient(90deg, ${c1}22, ${c2}22)`,
                                  border: `1px solid ${c1}44`,
                                  color: c1,
                                }}
                              >
                                {durationLabel(entry.durationSeconds)}
                              </span>
                              <span className="text-white/20 text-[10px]">{timeAgo(entry.createdAt)}</span>
                            </div>
                          </div>
                        </Link>

                        <button
                          onClick={() => setConfirmingId(entry.id)}
                          className="w-11 flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-50"
                          style={{ color: "rgba(255,255,255,0.15)" }}
                          aria-label="Delete story"
                        >
                          <span className="text-sm">🗑</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* FAB — only on My Stories tab */}
      {activeTab === "my-stories" && (
        <Link
          href="/studio"
          className="fixed w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-light z-40 active:scale-95 transition-transform"
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
