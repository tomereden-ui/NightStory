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
import ReadOnlyLessonsPanel from "@/components/story/ReadOnlyLessonsPanel";
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

// Strips a trailing "- Chapter N" / "- פרק N" suffix so the hero title reads
// as the story's name, not one specific chapter's title.
function seriesDisplayTitle(title: string): string {
  return title.replace(/\s*-\s*(chapter|פרק)\s*\d+\s*$/i, "").trim();
}

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { effective } = useViewMode();
  const stickyMaxWidth = effective === "desktop" ? 896 : effective === "tablet" ? 672 : 448;

  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  // Shares the series' first chapter's link (its landing page picks up every
  // sibling chapter from there) rather than whichever chapter is currently
  // open — a distinct flow from shareOpen, which always shares the chapter
  // on screen.
  const [shareAllOpen, setShareAllOpen] = useState(false);
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
  // Gates the Cast panel below — without this, it painted with an empty
  // characterAvatars map on first render (before fetchBankAvatars resolves),
  // which ReadOnlyCastPanel fills in with a DiceBear placeholder per
  // character. That's a real-looking but WRONG avatar, not an obvious
  // loading state, so it read as "starts with the old set, then swaps."
  const [avatarsResolved, setAvatarsResolved] = useState(false);

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
    setAvatarsResolved(false);
    if (!entry?.blocks?.length) return;
    let cancelled = false;
    (async () => {
      const uniqueChars = Array.from(new Set(entry.blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
      if (!uniqueChars.length) { setAvatarsResolved(true); return; }
      const bank = await fetchBankAvatars();
      if (cancelled) return;
      const avatars: Record<string, string> = {};
      for (const name of uniqueChars) {
        const type: CharacterType = entry.characterProfiles?.[name]?.type ?? (name === "Narrator" ? "narrator" : "adult");
        avatars[name] = resolveCharacterAvatar(name, type, bank, voicePool, entry.characterProfiles?.[name]?.avatarUrl);
      }
      setCharacterAvatars(avatars);
      setAvatarsResolved(true);
    })();
    return () => { cancelled = true; };
  }, [entry, voicePool]);

  // Persist block/voice changes for owned stories only — public/community/
  // classic entries aren't the viewer's to modify. isOwn (real family_id
  // match) not isPublic — a family's own story can be public and still
  // theirs to edit.
  const handleScriptBlocksChange = useCallback((blocks: ScriptBlock[]) => {
    setScriptBlocks(blocks);
    if (entry && entry.isOwn && !entry.isClassic) {
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

    // Every chapter of a series shares the same summary text and the same
    // narrated audio file (see assign-to-series, where the text is synced) —
    // keying the cache by series rather than by this one chapter's story ID
    // means switching chapters never re-synthesizes audio that's already
    // cached from another chapter.
    const summaryCacheKey = entry.seriesId ? `series-${entry.seriesId}` : `story-${entry.id}`;

    // Reuse cached audio URL from this session (survives component remounts)
    const sessionCached = summaryAudioCache.get(summaryCacheKey);
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
        body: JSON.stringify({ text: entry.summary, cacheKey: summaryCacheKey, childIds: entry.childIds }),
      });
      const { audioUrl } = await res.json() as { audioUrl: string };
      summaryAudioCache.set(summaryCacheKey, audioUrl);
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
  }, [entry?.id, entry?.summary, entry?.seriesId, entry?.childIds, summaryPlaying]);

  useEffect(() => {
    fetch(`/api/library/${id}`)
      .then((r) => r.json())
      .then((data) => setEntry("id" in data ? data : null))
      .catch(() => setEntry(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Sibling chapters — only fetched when this story is part of a series.
  const [chapters, setChapters] = useState<LibraryEntry[]>([]);
  useEffect(() => {
    if (!entry?.seriesId) { setChapters([]); return; }
    fetch(`/api/library?seriesId=${encodeURIComponent(entry.seriesId)}`)
      .then((r) => r.json())
      .then((data) => setChapters(Array.isArray(data) ? data : []))
      .catch(() => setChapters([]));
  }, [entry?.seriesId]);

  const [switchingChapter, setSwitchingChapter] = useState(false);

  // Swaps to a sibling chapter in place — no router navigation, so the cover
  // hero, back button, and chapters row never unmount/reflow. Only the audio
  // player and script content update to the new chapter's data. entry.seriesId
  // stays the same across chapters, so the chapters-row effect above doesn't
  // re-fetch either.
  // Once we've silently swapped the URL via replaceState at least once, the
  // browser's "previous" history entry is no longer reliable — router.back()
  // can land back on this same page's earlier chapter instead of wherever
  // the user actually came from. Falls back to a fixed destination instead.
  const [urlWasReplaced, setUrlWasReplaced] = useState(false);
  const goBack = useCallback(() => {
    if (urlWasReplaced) router.push("/library");
    else router.back();
  }, [urlWasReplaced, router]);

  const switchChapter = useCallback(async (newId: string) => {
    if (newId === entry?.id || switchingChapter) return;
    // Flush the outgoing chapter's position BEFORE setEntry swaps in the new
    // chapter's audioUrl — the <audio> element stays mounted across a switch
    // (only its src changes), and changing src resets currentTime to 0
    // immediately, so anything that tried to read it afterward would save 0
    // (or, below the 5s persist floor, nothing at all) instead of the real
    // last position, silently losing whatever the last periodic tick hadn't
    // caught yet.
    markPause();
    setSwitchingChapter(true);
    try {
      const res = await fetch(`/api/library/${newId}`);
      const data = await res.json();
      if ("id" in data) {
        setEntry(data);
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        window.history.replaceState(null, "", `/library/${newId}`);
        setUrlWasReplaced(true);
      }
    } catch {
      // keep current chapter on failure
    } finally {
      setSwitchingChapter(false);
    }
  }, [entry?.id, switchingChapter, markPause]);

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

  const handleOpenShareAll = useCallback(() => {
    if (allChildren.length === 0) {
      fetch("/api/child-profiles").then((r) => r.json()).then((d) => {
        if (Array.isArray(d)) setAllChildren(d as DBChildProfile[]);
      }).catch(() => {});
    }
    setShareAllOpen(true);
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
    // isOwn (real family_id match), not isPublic — a family's own story can
    // be shared/public and still be editable in place by that family. Using
    // isPublic here previously made any of the user's own public stories
    // silently fork into a brand-new draft on every "edit", so title/cover
    // changes never touched the original row.
    const isOwned = !!entry.isOwn && !entry.isClassic;
    writeDraft({
      promptText: "",
      scriptBlocks: entry.blocks,
      summary: entry.summary,
      coverPrompt: "",
      coverUrl: entry.coverUrl ?? "",
      coverFocusX: entry.coverFocusX,
      coverFocusY: entry.coverFocusY,
      editingStoryId: isOwned ? entry.id : undefined,
      forkedFromTitle: isOwned ? undefined : entry.title,
      storyTitle: entry.title,
      language: entry.language,
      // Whether editing forks a private copy (isOwned above) is about who
      // owns the STORY ROW -- separate from whether there's audio worth
      // hearing. A classic or another family's story still has real,
      // listenable audio; forking it into your own editable copy shouldn't
      // also throw that away and leave Studio's player silently empty until
      // you produce a duplicate of what already exists. Always carry it
      // over -- the fork banner already makes clear this is your own copy,
      // and editing/producing on it can never touch the original either way.
      audioUrl: entry.audioUrl,
      durationSeconds: entry.durationSeconds,
      moralLessons: entry.moralLessons,
      // Without profiles the Studio falls back to re-classifying the whole
      // cast from scratch (fresh Gemini pass + Imagen avatar generation),
      // producing different cast art than this story page shows. Passing the
      // persisted profiles (incl. each character's matched avatarUrl) keeps
      // Studio's cast identical to the story card's.
      characterProfiles: entry.characterProfiles,
      scenes: entry.scenes,
    }, "nightstory_studio2_draft_v1");
    router.push("/studio?tab=script");
  }, [entry, router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!entry) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/library/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      // Go back to wherever the user came from (library grid, home, a child's
      // profile, etc.) instead of hardcoding one destination — the story no
      // longer exists, so there's nothing to show by staying on this card.
      goBack();
    } catch (err) {
      console.error("[handleDeleteConfirm]", err);
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }, [entry, router]);

  if (loading) {
    return (
      <div className="cosmic-page min-h-full flex items-center justify-center">
        <span className="text-white/55 text-fs-body animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="cosmic-page min-h-full flex flex-col items-center justify-center gap-4">
        <span className="text-fs-display">🌙</span>
        <p className="text-white/55 text-fs-body">Story not found.</p>
        <button onClick={goBack} className="text-fs-body" style={{ color: "rgba(79,195,247,0.5)" }}>Go back</button>
      </div>
    );
  }

  // Only the owner can delete — public/community/classic entries aren't theirs to remove.
  const isOwned = !!entry.isOwn && !entry.isClassic;

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
        onDurationChange={() => { setDuration(audioRef.current?.duration ?? 0); applyResumeSeek(); }}
      />

      <div className="pb-64">
        {/* Cover area — same 16:9 crop + focus point as Studio's own cover
            header (ScriptTab), so a story reads identically here as it does
            there instead of a differently-shaped box. The starfield backdrop
            only shows through when there's no cover art yet. */}
        <div className="relative overflow-hidden" style={{ flexShrink: 0, aspectRatio: "16/9" }}>
          {entry.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.coverUrl}
              alt={entry.title}
              className="absolute inset-0 w-full h-full object-cover ken-burns"
              style={{ objectPosition: `${entry.coverFocusX ?? 50}% ${entry.coverFocusY ?? 30}%` }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 25%, rgba(79,195,247,0.2) 0%, transparent 60%)," +
                  "radial-gradient(ellipse 50% 50% at 80% 80%, rgba(45,27,78,0.5) 0%, transparent 55%)," +
                  "radial-gradient(ellipse 60% 70% at 10% 80%, rgba(10,61,74,0.4) 0%, transparent 55%)," +
                  "linear-gradient(180deg,#060a18 0%,#0d1a3a 40%,#1a0a38 80%,#05080f 100%)",
              }}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 260" fill="none">
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
                <circle cx="160" cy="120" r="40" fill="rgba(79,195,247,0.06)"/>
                <circle cx="160" cy="120" r="20" fill="rgba(79,195,247,0.1)"/>
                <circle cx="160" cy="120" r="8"  fill="rgba(150,220,255,0.2)"/>
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
          {/* Back button */}
          <button
            onClick={goBack}
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
            {entry.chapterCount && entry.chapterCount > 1 ? seriesDisplayTitle(entry.title) : entry.title}
          </h1>
          <p className="text-fs-caption font-mono mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Id = {entry.id}
          </p>
        </div>

        {/* Chapter list — only shown for stories that are part of a series.
            Horizontal row of small cover cards (Netflix "episodes" style) —
            replaced the earlier full-width row list because a spread of
            cover thumbnails reads at a glance which chapter is which,
            instead of relying on title text alone. */}
        {chapters.length > 1 && (
          <div className="mt-3 mb-1">
            <div className="flex items-center justify-between mb-2.5 px-5">
              <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.45)" }}>
                Chapters
              </p>
              <button
                onClick={handleOpenShareAll}
                className="flex items-center gap-1 text-fs-body font-semibold transition-all active:scale-95"
                style={{ color: "#a78bfa" }}
              >
                <Icon name="share" size={12} />
                <span>Share whole story</span>
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
              {chapters.map((c) => {
                const isCurrent = c.id === entry.id;
                const [cc1, cc2] = cardPalette(c.title);
                return (
                  <button
                    key={c.id}
                    onClick={() => switchChapter(c.id)}
                    disabled={switchingChapter}
                    className="flex-shrink-0 rounded-2xl overflow-hidden text-left transition-all active:scale-[0.96] select-none relative"
                    style={{
                      width: 108,
                      height: 152,
                      border: isCurrent ? "2px solid #4fc3f7" : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: isCurrent ? "0 0 16px rgba(79,195,247,0.35)" : "0 4px 14px rgba(0,0,0,0.4)",
                      opacity: switchingChapter && !isCurrent ? 0.5 : 1,
                    }}
                  >
                    {c.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverUrl} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ background: `linear-gradient(145deg, ${cc1}33, ${cc2}66)` }}>
                        🌙
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(4,6,18,0.95) 100%)" }} />
                    <span
                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-fs-body font-bold"
                      style={{ background: isCurrent ? "#4fc3f7" : "rgba(5,8,20,0.75)", color: isCurrent ? "#04101a" : "rgba(255,255,255,0.75)", backdropFilter: "blur(4px)" }}
                    >
                      {c.chapterNumber ?? "–"}
                    </span>
                    {isCurrent && (
                      <span className="absolute top-1.5 right-1.5 text-fs-body" style={{ color: "#4fc3f7" }}>▶</span>
                    )}
                    <p className="absolute bottom-1.5 left-2 right-2 text-fs-body font-semibold text-white line-clamp-2 leading-tight">
                      {c.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                    ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }
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
            <Icon name="share" size={16} />
            <span>Share</span>
          </button>
        </div>

        {/* Cast panel — read-only. Waits for avatarsResolved so it never
            paints a character with the wrong (but real-looking) DiceBear
            fallback before the real bank avatar swaps in. */}
        {entry.blocks.length > 0 && avatarsResolved && (
          <div className="mt-4 mb-1">
            <ReadOnlyCastPanel blocks={entry.blocks} characterAvatars={characterAvatars} />
          </div>
        )}

        {/* Values panel — same presentation as Studio's collapsed view, read-only */}
        {entry.moralLessons && entry.moralLessons.length > 0 && (
          <div className="mt-4 px-5">
            <ReadOnlyLessonsPanel moralLessons={entry.moralLessons} storyLanguage={entry.language} />
          </div>
        )}

        {/* Divider + script panel — only when there's actually a script to show.
            A story can end up with an empty blocks array despite having real
            audio (e.g. an older data issue), and ScriptTab's own empty state
            ("Generate a story first…") reads as broken/confusing on a story
            page that's clearly already produced — so hide the whole section
            instead of showing that message here. */}
        {scriptBlocks.length > 0 && (
        <>
        <div className="mx-5 my-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

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
            // Prefer the live <audio> element's real, exact duration — same
            // precedence the sticky player's own total uses just below — over
            // entry.durationSeconds (a rounded DB snapshot). Scene durations
            // are scaled to sum to whichever number this is (see SceneMap),
            // so passing a different source than what the player displays is
            // exactly what made the two totals visibly disagree.
            totalDurationSeconds={duration || entry.durationSeconds}
            readOnlyScript
            hideDurationPicker
            hideProduceButton
            hideDirectorsNote
          />
        </div>
        </>
        )}

        {/* Actions row */}
        {confirmingDelete ? (
          <div className="mx-5 mt-8 mb-4 rounded-2xl px-4 py-4 flex flex-col gap-3"
            style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.35)" }}>
            <p className="text-fs-body text-white/70">
              Move to trash <span className="text-white font-medium">"{entry.title}"</span>?
            </p>
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.52)" }}>
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
            {isOwned && (
              <button
                onClick={handleEdit}
                className="flex-1 py-3.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.3)", color: "rgba(79,195,247,0.9)" }}
              >
                <span>🎬</span>
                <span>Open in Studio</span>
              </button>
            )}
            {isOwned && (
              <button
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete story"
                className="w-14 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}
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

        {shareAllOpen && chapters[0] && (
          <ShareSheet
            story={chapters[0]}
            titleOverride={seriesDisplayTitle(chapters[0].title)}
            children={allChildren}
            onClose={() => setShareAllOpen(false)}
            onMessageSaved={(msg) => {
              setChapters((cs) => cs.map((c) => (c.id === chapters[0].id ? { ...c, shareMessage: msg } : c)));
              setEntry((e) => (e && e.id === chapters[0].id ? { ...e, shareMessage: msg } : e));
            }}
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
                  <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.52)" }}>
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
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Start over
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-fs-body w-8 text-right flex-shrink-0" style={{ color: "rgba(255,255,255,0.52)" }}>
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
              <span className="text-fs-body w-8 flex-shrink-0" style={{ color: "rgba(255,255,255,0.52)" }}>
                {formatTime(duration || entry.durationSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
