"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { writeDraft } from "@/lib/draftStore";
import { useViewMode } from "@/context/ViewModeContext";
import type { LibraryEntry } from "@/lib/libraryStore";
import Icon from "@/components/ui/Icon";
import type { ScriptBlock, Voice } from "@/types";
import ShareSheet from "@/components/ShareSheet";
import ReadOnlyCastPanel from "@/components/story/ReadOnlyCastPanel";
import ScriptTab from "@/components/studio/ScriptTab";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import { fetchBankAvatars, resolveCharacterAvatar, type CharacterType } from "@/lib/services/characterAvatars";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import { useListeningProgress } from "@/hooks/useListeningProgress";

// Persists summary audio URLs across component mounts within a session
const summaryAudioCache = new Map<string, string>();

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { effective } = useViewMode();
  const stickyMaxWidth = effective === "desktop" ? 896 : effective === "tablet" ? 672 : 448;

  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [allChildren, setAllChildren] = useState<DBChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { resumeFrom, markTick, markPause, markEnded, applyResumeSeek, clearResumePrompt } =
    useListeningProgress({ storyId: entry?.id, audioRef });

  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [summaryPlaying, setSummaryPlaying] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // ─── Script panel — same component/look as Studio's ScriptTab ─────────────
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [voicePool, setVoicePool] = useState<Voice[]>(PRESET_VOICE_POOL);
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entry) setScriptBlocks(entry.blocks);
  }, [entry]);

  useEffect(() => {
    fetchVoicePool(entry?.language).then(setVoicePool);
  }, [entry?.language]);

  // Deterministic bank-based avatars only (no live Gemini/Imagen generation)
  // — this is a read view, not an active creation session, so it should
  // look the same on every visit rather than regenerating art each time.
  useEffect(() => {
    if (!entry?.blocks?.length) return;
    let cancelled = false;
    (async () => {
      const uniqueChars = Array.from(new Set(entry.blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
      if (!uniqueChars.length) return;
      const bank = await fetchBankAvatars();
      if (cancelled) return;
      const avatars: Record<string, string> = {};
      for (const name of uniqueChars) {
        const type: CharacterType = entry.characterProfiles?.[name]?.type ?? (name === "Narrator" ? "narrator" : "adult");
        avatars[name] = resolveCharacterAvatar(name, type, bank, voicePool);
      }
      setCharacterAvatars(avatars);
    })();
    return () => { cancelled = true; };
  }, [entry, voicePool]);

  // Persist block/voice changes for owned stories only — public/community/
  // classic entries aren't the viewer's to modify.
  const handleScriptBlocksChange = useCallback((blocks: ScriptBlock[]) => {
    setScriptBlocks(blocks);
    if (entry && !entry.isPublic && !entry.isClassic) {
      fetch(`/api/library/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      }).catch(() => {});
    }
  }, [entry]);

  useEffect(() => {
    return () => {
      if (summaryAudioRef.current) {
        summaryAudioRef.current.pause();
        summaryAudioRef.current.src = "";
        summaryAudioRef.current = null;
      }
    };
  }, []);

  const toggleSummaryPlay = useCallback(async () => {
    if (summaryPlaying) {
      summaryAudioRef.current?.pause();
      setSummaryPlaying(false);
      return;
    }
    if (!entry?.summary) return;

    // Reuse cached audio URL from this session (survives component remounts)
    const sessionCached = entry?.id ? summaryAudioCache.get(entry.id) : undefined;
    if (sessionCached) {
      const audio = new Audio(sessionCached);
      audio.onended = () => setSummaryPlaying(false);
      audio.onerror = () => setSummaryPlaying(false);
      summaryAudioRef.current = audio;
      await audio.play();
      setSummaryPlaying(true);
      return;
    }

    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entry.summary, cacheKey: `story-${entry.id}` }),
      });
      const { audioUrl } = await res.json() as { audioUrl: string };
      if (entry?.id) summaryAudioCache.set(entry.id, audioUrl);
      const audio = new Audio(audioUrl);
      audio.onended = () => setSummaryPlaying(false);
      audio.onerror = () => setSummaryPlaying(false);
      summaryAudioRef.current = audio;
      await audio.play();
      setSummaryPlaying(true);
    } catch {
      setSummaryPlaying(false);
    } finally {
      setSummaryLoading(false);
    }
  }, [entry?.id, entry?.summary, summaryPlaying]);

  useEffect(() => {
    fetch(`/api/library/${id}`)
      .then((r) => r.json())
      .then((data) => setEntry("id" in data ? data : null))
      .catch(() => setEntry(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Same key the home page uses to track which child profile is active —
  // favorites are scoped per-child, matching how child_ids scopes stories.
  useEffect(() => {
    setActiveChildId(typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null);
  }, []);

  const isFavorited = !!(activeChildId && entry?.favoritedBy?.includes(activeChildId));

  const handleToggleFavorite = useCallback(async () => {
    if (!entry || !activeChildId || favoriteBusy) return;
    const nextFavorited = !isFavorited;
    setFavoriteBusy(true);
    // Optimistic update
    setEntry((e) => e ? {
      ...e,
      favoritedBy: nextFavorited
        ? [...(e.favoritedBy ?? []), activeChildId]
        : (e.favoritedBy ?? []).filter((c) => c !== activeChildId),
    } : e);
    try {
      const res = await fetch(`/api/library/${entry.id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: activeChildId, favorited: nextFavorited }),
      });
      if (!res.ok) throw new Error("failed");
      const { favoritedBy } = await res.json() as { favoritedBy: string[] };
      setEntry((e) => e ? { ...e, favoritedBy } : e);
    } catch {
      // Revert on failure
      setEntry((e) => e ? {
        ...e,
        favoritedBy: isFavorited
          ? [...(e.favoritedBy ?? []), activeChildId]
          : (e.favoritedBy ?? []).filter((c) => c !== activeChildId),
      } : e);
    } finally {
      setFavoriteBusy(false);
    }
  }, [entry, activeChildId, favoriteBusy, isFavorited]);

  const handleOpenShare = useCallback(() => {
    if (allChildren.length === 0) {
      fetch("/api/child-profiles").then((r) => r.json()).then((d) => {
        if (Array.isArray(d)) setAllChildren(d as DBChildProfile[]);
      }).catch(() => {});
    }
    setShareOpen(true);
  }, [allChildren.length]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }, [playing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  };

  const handleStartOver = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    clearResumePrompt();
  };

  const handleEdit = useCallback(() => {
    if (!entry) return;
    const isOwned = !entry.isPublic && !entry.isClassic;
    writeDraft({
      promptText: "",
      scriptBlocks: entry.blocks,
      summary: entry.summary,
      coverPrompt: "",
      coverUrl: entry.coverUrl ?? "",
      editingStoryId: isOwned ? entry.id : undefined,
      forkedFromTitle: isOwned ? undefined : entry.title,
      storyTitle: entry.title,
      language: entry.language,
      audioUrl: isOwned ? entry.audioUrl : undefined,
      moralLessons: entry.moralLessons,
    }, "nightstory_studio2_draft_v1");
    router.push("/studio2");
  }, [entry, router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!entry) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/library/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/library");
    } catch {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }, [entry, router]);

  if (loading) {
    return (
      <div className="cosmic-page min-h-full flex items-center justify-center">
        <span className="text-white/30 text-fs-body animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="cosmic-page min-h-full flex flex-col items-center justify-center gap-4">
        <span className="text-fs-display">🌙</span>
        <p className="text-white/30 text-fs-body">Story not found.</p>
        <button onClick={() => router.back()} className="text-fs-body" style={{ color: "rgba(79,195,247,0.5)" }}>Go back</button>
      </div>
    );
  }

  // Only the owner can delete — public/community/classic entries aren't theirs to remove.
  const isOwned = !entry.isPublic && !entry.isClassic;

  return (
    <div className="cosmic-page min-h-full">
      <audio
        ref={audioRef}
        src={entry.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); markPause(); }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); markEnded(); }}
        onTimeUpdate={() => { setCurrentTime(audioRef.current?.currentTime ?? 0); markTick(); }}
        onLoadedMetadata={() => { setDuration(audioRef.current?.duration ?? 0); applyResumeSeek(); }}
      />

      <div className="pb-64">
        {/* Atmospheric cover area */}
        <div className="relative h-52 overflow-hidden" style={{ flexShrink: 0 }}>
          {entry.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover ken-burns" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 25%, rgba(79,195,247,0.2) 0%, transparent 60%)," +
                  "radial-gradient(ellipse 50% 50% at 80% 80%, rgba(45,27,78,0.5) 0%, transparent 55%)," +
                  "radial-gradient(ellipse 60% 70% at 10% 80%, rgba(10,61,74,0.4) 0%, transparent 55%)," +
                  "linear-gradient(180deg,#060a18 0%,#0d1a3a 40%,#1a0a38 80%,#05080f 100%)",
              }}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 208" fill="none">
                <circle cx="30" cy="25" r="1" fill="rgba(255,255,255,.6)"/>
                <circle cx="80" cy="15" r="1.2" fill="rgba(255,255,255,.7)"/>
                <circle cx="140" cy="30" r=".8" fill="rgba(200,220,255,.8)"/>
                <circle cx="200" cy="18" r="1" fill="rgba(255,255,255,.6)"/>
                <circle cx="260" cy="28" r="1.1" fill="rgba(255,255,255,.7)"/>
                <circle cx="290" cy="12" r=".8" fill="rgba(200,220,255,.5)"/>
                <circle cx="50" cy="55" r=".9" fill="rgba(255,255,255,.5)"/>
                <circle cx="170" cy="45" r="1" fill="rgba(200,220,255,.6)"/>
                <circle cx="240" cy="60" r=".8" fill="rgba(255,255,255,.7)"/>
                <circle cx="80" cy="45" r="1" fill="rgba(180,210,255,.7)"/>
                <circle cx="100" cy="38" r="1" fill="rgba(180,210,255,.7)"/>
                <circle cx="120" cy="48" r="1" fill="rgba(180,210,255,.7)"/>
                <line x1="80" y1="45" x2="100" y2="38" stroke="rgba(180,210,255,.2)" strokeWidth=".6"/>
                <line x1="100" y1="38" x2="120" y2="48" stroke="rgba(180,210,255,.2)" strokeWidth=".6"/>
                <circle cx="160" cy="100" r="40" fill="rgba(79,195,247,0.06)"/>
                <circle cx="160" cy="100" r="20" fill="rgba(79,195,247,0.1)"/>
                <circle cx="160" cy="100" r="8"  fill="rgba(150,220,255,0.2)"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl" style={{ filter: "drop-shadow(0 0 24px rgba(79,195,247,0.5))" }}>🌙</span>
              </div>
            </div>
          )}

          {/* Gradient fade to page bg */}
          <div
            className="absolute bottom-0 left-0 right-0 h-20"
            style={{ background: "linear-gradient(to bottom, transparent, #05080F)" }}
          />
          {/* Now playing label */}
          <div className="absolute bottom-6 left-5">
            <span className="text-fs-body tracking-widest uppercase" style={{ color: "rgba(79,195,247,0.7)" }}>
              Now Playing
            </span>
          </div>
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-12 left-4 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "rgba(5,8,20,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Icon name="back" size={18} className="text-white/60" />
          </button>
        </div>

        {/* Title — big, prominent */}
        <div className="px-5 mt-4 mb-1">
          <h1
            className="text-fs-title text-fs-title font-bold tracking-tight leading-tight mb-1"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #4fc3f7 55%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 14px rgba(79,195,247,0.3))",
            }}
          >
            {entry.title}
          </h1>
          <p className="text-fs-caption font-mono mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Id = {entry.id}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>
              {timeAgo(entry.createdAt)}
            </p>
            {(entry.viewCount ?? 0) > 0 && (
              <p className="text-fs-body" style={{ color: "rgba(79,195,247,0.55)" }}>
                · 👁 {entry.viewCount} {entry.viewCount === 1 ? "view" : "views"}
                {(entry.shareCount ?? 0) > 0 && ` · 📤 shared ${entry.shareCount}×`}
              </p>
            )}
          </div>
        </div>

        {/* Summary card */}
        {entry.summary && (
          <div className="mx-5 mt-3 mb-1 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.45)" }}>Story</p>
              <button
                onClick={toggleSummaryPlay}
                disabled={summaryLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-fs-body font-semibold transition-all active:scale-95"
                style={summaryPlaying
                  ? { background: "rgba(79,195,247,0.18)", border: "1px solid rgba(79,195,247,0.45)", color: "#4fc3f7", boxShadow: "0 0 10px rgba(79,195,247,0.2)" }
                  : summaryLoading
                    ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }
                    : { background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)", color: "rgba(79,195,247,0.8)" }
                }
              >
                {summaryPlaying ? <Icon name="pause" size={11} /> : summaryLoading ? "…" : <Icon name="play" size={11} />}
                <span>{summaryPlaying ? "Stop" : summaryLoading ? "Loading…" : "Play summary"}</span>
              </button>
            </div>
            {(() => {
              const LIMIT = 220;
              const long = entry.summary.length > LIMIT;
              const shown = !summaryExpanded && long ? entry.summary.slice(0, LIMIT).trimEnd() : entry.summary;
              return (
                <p className="text-fs-body" style={{ lineHeight: "1.7", color: "rgba(255,255,255,0.85)", fontWeight: 400 }}>
                  {shown}
                  {long && !summaryExpanded && (
                    <button onClick={() => setSummaryExpanded(true)} className="ml-1 font-semibold" style={{ color: "#4fc3f7", fontSize: "var(--fs-label)" }}>
                      … more
                    </button>
                  )}
                </p>
              );
            })()}
          </div>
        )}

        {/* Favorite + Share row */}
        <div className="px-5 mb-1 flex items-center gap-3">
          <button
            onClick={handleToggleFavorite}
            disabled={!activeChildId || favoriteBusy}
            aria-label={isFavorited ? "Remove from My List" : "Add to My List"}
            aria-pressed={isFavorited}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-fs-body font-semibold transition-all active:scale-90"
            style={isFavorited
              ? { background: "rgba(236,72,153,0.14)", border: "1px solid rgba(236,72,153,0.4)", color: "#ec4899" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }
            }
          >
            <span style={{ fontSize: "var(--fs-heading)", lineHeight: 1 }}>{isFavorited ? "❤️" : "🤍"}</span>
            <span>{isFavorited ? "In My List" : "Add to My List"}</span>
          </button>
          <button
            onClick={handleOpenShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-fs-body font-semibold transition-all active:scale-90"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}
          >
            <span style={{ fontSize: "var(--fs-heading)", lineHeight: 1 }}>📤</span>
            <span>Share</span>
          </button>
        </div>

        {/* Cast panel — read-only */}
        {entry.blocks.length > 0 && (
          <div className="mt-4 mb-1">
            <ReadOnlyCastPanel blocks={entry.blocks} />
          </div>
        )}

        {/* Divider */}
        <div className="mx-5 my-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Script panel — same component, look, and functionality as Studio's */}
        <div className="px-5">
          <ScriptTab
            blocks={scriptBlocks}
            voices={voicePool}
            onBlocksChange={handleScriptBlocksChange}
            onProduce={() => {}}
            isProducing={false}
            characterAvatars={characterAvatars}
            storyId={entry.id}
            scenes={entry.scenes}
            readOnlyScript
            hideDurationPicker
            hideProduceButton
            hideDirectorsNote
          />
        </div>

        {/* Actions row */}
        {confirmingDelete ? (
          <div className="mx-5 mt-8 mb-4 rounded-2xl px-4 py-4 flex flex-col gap-3"
            style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.35)" }}>
            <p className="text-fs-body text-white/70">
              Move to trash <span className="text-white font-medium">"{entry.title}"</span>?
            </p>
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>
              Kept for 30 days — you can restore it from Trash.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-fs-body transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
                style={{ background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.4)", color: "#EC4899" }}
              >
                {isDeleting ? "…" : "Move to trash"}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 mt-8 mb-4 flex gap-3">
            <button
              onClick={handleEdit}
              className="flex-1 py-3.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.3)", color: "rgba(79,195,247,0.9)" }}
            >
              <span>🎬</span>
              <span>Open in Studio</span>
            </button>
            {isOwned && (
              <button
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete story"
                className="w-14 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
              >
                <Icon name="delete" size={16} />
              </button>
            )}
          </div>
        )}

        {shareOpen && entry && (
          <ShareSheet
            story={entry}
            children={allChildren}
            onClose={() => setShareOpen(false)}
            onMessageSaved={(msg) => setEntry((e) => e ? { ...e, shareMessage: msg } : e)}
          />
        )}
      </div>

      {/* Sticky player bar — constrained to app width */}
      <div
        className="fixed bottom-0 left-0 right-0 pt-6"
        style={{ background: "linear-gradient(to top, #05080F 70%, transparent)", zIndex: 40 }}
      >
        <div className="mx-auto px-4 pb-20" style={{ maxWidth: stickyMaxWidth }}>
          <div
            className="rounded-2xl px-4 py-3.5"
            style={{
              background: "rgba(5,8,20,0.92)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handlePlayPause}
                className="w-11 h-11 rounded-full flex items-center justify-center text-fs-heading flex-shrink-0 active:scale-95 transition-transform"
                style={{
                  background: "rgba(79,195,247,0.14)",
                  border: "1.5px solid rgba(79,195,247,0.45)",
                  boxShadow: "0 0 14px rgba(79,195,247,0.3)",
                }}
              >
                {playing ? <Icon name="pause" size={20} /> : <Icon name="play" size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-white text-fs-body font-medium truncate leading-snug">{entry.title}</p>
                {entry.summary && (
                  <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {entry.summary.split(" ").slice(0, 6).join(" ")}…
                  </p>
                )}
              </div>
            </div>

            {resumeFrom != null && (
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-fs-body" style={{ color: "rgba(79,195,247,0.6)" }}>
                  ▶ Resumed from {formatTime(resumeFrom)}
                </p>
                <button
                  onClick={handleStartOver}
                  className="text-fs-body font-semibold"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Start over
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-fs-body w-8 text-right flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || entry.durationSeconds}
                step={0.5}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 cursor-pointer"
                style={{ accentColor: "#4fc3f7" }}
              />
              <span className="text-fs-body w-8 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                {formatTime(duration || entry.durationSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
