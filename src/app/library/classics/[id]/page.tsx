"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { writeDraft } from "@/lib/draftStore";
import { useViewMode } from "@/context/ViewModeContext";
import type { ClassicMeta } from "@/lib/classicStories";
import { CLASSIC_STORIES } from "@/lib/classicStories";
import type { ScriptBlock, StoryScene, Voice, MoralLesson } from "@/types";
import Icon from "@/components/ui/Icon";
import BookCover from "@/components/ui/BookCover";
import ReadOnlyCastPanel from "@/components/story/ReadOnlyCastPanel";
import ReadOnlyLessonsPanel from "@/components/story/ReadOnlyLessonsPanel";
import ScriptTab from "@/components/studio/ScriptTab";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import { fetchBankAvatars, resolveCharacterAvatar, type CharacterType } from "@/lib/services/characterAvatars";
import ShareSheet from "@/components/ShareSheet";
import type { LibraryEntry, CharacterProfile } from "@/lib/libraryStore";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import { useListeningProgress } from "@/hooks/useListeningProgress";
import { useAuth } from "@/context/AuthContext";

const ADMIN_EMAIL = "tomereden@gmail.com";

// Persists summary audio URLs across component mounts within a session
const summaryAudioCache = new Map<string, string>();

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Strips a trailing "- Chapter N" / "- פרק N" suffix so the hero title reads
// as the story's name, not one specific chapter's title.
function seriesDisplayTitle(title: string): string {
  return title.replace(/\s*-\s*(chapter|פרק)\s*\d+\s*$/i, "").trim();
}

// Last-resort fallback for a classic with no curated tagline (e.g. an
// admin-added one nobody wrote a blurb for) -- NOT the primary summary
// source. Capped at 40 words: this used to join up to 3 full narration
// blocks with no length limit at all, which meant it could run to 100+
// words of raw script text (and, since the audio preview reads out
// whatever this returns verbatim, that was slow enough to time out the
// primary TTS engine on some stories).
function deriveClassicSummary(blocks: ScriptBlock[]): string {
  const speechBlocks = blocks.filter((b) => b.characterName !== "SFX");
  // The Narrator's name is always translated into the story's language (see
  // story-guidance.txt), so an English-only "narrat" match silently finds
  // nothing for non-English classics. "קריין" is the one translation we can
  // state with certainty (from the guidance file itself); for every other
  // language, fall back to the opening lines regardless of character name so
  // the summary card never silently disappears.
  const narratorLines = speechBlocks.filter((b) => {
    const name = b.characterName.toLowerCase();
    return name.includes("narrat") || b.characterName.includes("קריין");
  });
  const source = narratorLines.length > 0 ? narratorLines : speechBlocks;
  const text = source
    .slice(0, 3)
    .map((b) => b.textPayload.replace(/^\[.*?\]\s*/, ""))
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, 40).join(" ") + (words.length > 40 ? "…" : "");
}

// The one summary shown/spoken everywhere on this page. Prefers the
// curated tagline (short, written to sell the story) over the derived
// fallback above.
function getClassicSummary(tagline: string | undefined, blocks: ScriptBlock[]): string {
  return tagline?.trim() || deriveClassicSummary(blocks);
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

export default function ClassicDetailPage() {
  const { id: routeId } = useParams<{ id: string }>();
  // The chapter actually being viewed — starts at the route id, but chapter
  // switching updates this in place (see switchChapter) instead of
  // navigating, so the cover hero / back button never unmount or reflow.
  const [id, setId] = useState(routeId);
  useEffect(() => { setId(routeId); }, [routeId]);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const { effective } = useViewMode();
  const stickyMaxWidth = effective === "desktop" ? 896 : effective === "tablet" ? 672 : 448;

  const [meta, setMeta] = useState<ClassicMeta | null>(null);
  const [blocks, setBlocks] = useState<ScriptBlock[] | null>(null);
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [storyLanguage, setStoryLanguage] = useState<string | undefined>(undefined);
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, CharacterProfile> | undefined>(undefined);
  const [moralLessons, setMoralLessons] = useState<MoralLesson[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Used only to decide Studio-open behavior (fork vs edit-in-place) — every
  // hardcoded classic already has its own `stories` row (created the moment
  // its script is generated), so favorite/share work for it regardless.
  const isHardcoded = CLASSIC_STORIES.some((s) => s.id === id);
  const [favoritedBy, setFavoritedBy] = useState<string[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [allChildren, setAllChildren] = useState<DBChildProfile[]>([]);
  const [openingInStudio, setOpeningInStudio] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // ─── Script panel — same component/look as Studio's ScriptTab ─────────────
  const [voicePool, setVoicePool] = useState<Voice[]>(PRESET_VOICE_POOL);
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchVoicePool().then(setVoicePool);
  }, []);

  // Deterministic bank-based avatars only (no live Gemini/Imagen generation)
  // — a classic's cast should look the same on every visit, not regenerate.
  useEffect(() => {
    if (!blocks?.length) return;
    let cancelled = false;
    (async () => {
      const uniqueChars = Array.from(new Set(blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
      if (!uniqueChars.length) return;
      const bank = await fetchBankAvatars();
      if (cancelled) return;
      const avatars: Record<string, string> = {};
      for (const name of uniqueChars) {
        const type: CharacterType = characterProfiles?.[name]?.type ?? (name.toLowerCase().includes("narrat") ? "narrator" : "adult");
        avatars[name] = resolveCharacterAvatar(name, type, bank, voicePool, characterProfiles?.[name]?.avatarUrl);
      }
      setCharacterAvatars(avatars);
    })();
    return () => { cancelled = true; };
  }, [blocks, voicePool, characterProfiles]);
  const [summaryPlaying, setSummaryPlaying] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Story audio player ────────────────────────────────────────────────────
  const storyAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [storyAudioUrl, setStoryAudioUrl] = useState<string | null>(null);
  const [producing, setProducing] = useState(false);
  const [produceProgress, setProduceProgress] = useState(0);
  const [produceStep, setProduceStep] = useState("");
  const produceCancelRef = useRef(false);
  const { resumeFrom, markTick, markPause, markEnded, applyResumeSeek, clearResumePrompt } =
    useListeningProgress({ storyId: id, audioRef: storyAudioRef });

  useEffect(() => {
    return () => {
      produceCancelRef.current = true;
      if (summaryAudioRef.current) {
        summaryAudioRef.current.pause();
        summaryAudioRef.current.src = "";
        summaryAudioRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    const audio = storyAudioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }, [playing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = storyAudioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
  };

  const handleStartOver = () => {
    const audio = storyAudioRef.current;
    if (audio) audio.currentTime = 0;
    clearResumePrompt();
  };

  const handleProduceAudio = useCallback(async () => {
    if (!blocks || !meta || producing) return;
    produceCancelRef.current = false;
    setProducing(true);
    setProduceProgress(0);
    setProduceStep("Starting…");

    try {
      const summary = getClassicSummary(meta.tagline, blocks);
      const durationMinutes = meta.durationSeconds ? Math.max(1, Math.round(meta.durationSeconds / 60)) : 3;
      // Persist to this classic's own id (not a fresh random one) so replaying
      // it later never re-generates audio, and favorite/share keep working.
      const res = await fetch("/api/produce-drama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, durationMinutes, summary, editingStoryId: id, isClassic: true, isPublic: true }),
      });
      const { jobId, error } = await res.json() as { jobId?: string; error?: string };
      if (error || !jobId) throw new Error(error ?? "Production failed");

      while (!produceCancelRef.current) {
        await new Promise((r) => setTimeout(r, 2000));
        if (produceCancelRef.current) break;
        const status = await fetch(`/api/drama-status/${jobId}`).then((r) => r.json()) as {
          status: string; progress?: number; step?: string; audioUrl?: string;
        };
        if (produceCancelRef.current) break;
        setProduceProgress(status.progress ?? 0);
        setProduceStep(status.step ?? "…");
        if (status.status === "done" && status.audioUrl) {
          setStoryAudioUrl(status.audioUrl);
          setProducing(false);
          return;
        }
        if (status.status === "error") {
          setProducing(false);
          return;
        }
      }
    } catch {
      if (!produceCancelRef.current) setProducing(false);
    }
  }, [blocks, meta, producing]);

  useEffect(() => {
    Promise.all([
      fetch("/api/classics", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: ClassicMeta[]) => Array.isArray(data) ? data.find((c) => c.id === id) ?? null : null)
        .catch(() => null),
      fetch(`/api/classics/${id}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([m, full]) => {
      setMeta(m);
      setImgFailed(false);
      if (full?.blocks) setBlocks(full.blocks);
      if (full?.audioUrl) setStoryAudioUrl(full.audioUrl);
      if (Array.isArray(full?.favoritedBy)) setFavoritedBy(full.favoritedBy);
      if (Array.isArray(full?.scenes)) setScenes(full.scenes);
      if (full?.language) setStoryLanguage(full.language);
      if (full?.characterProfiles) setCharacterProfiles(full.characterProfiles);
      if (Array.isArray(full?.moralLessons)) setMoralLessons(full.moralLessons);
    }).finally(() => setLoading(false));
  }, [id]);

  // True for the moment between requesting a chapter switch and the fetch
  // effect above actually landing new data for it (meta.id still reflects
  // the previous chapter until then).
  const switchingChapter = meta?.id !== id;

  // Once we've silently swapped the URL via replaceState at least once, the
  // browser's "previous" history entry is no longer reliable — router.back()
  // can land back on this same page's earlier chapter instead of wherever
  // the user actually came from. Falls back to a fixed destination instead.
  const [urlWasReplaced, setUrlWasReplaced] = useState(false);
  const goBack = useCallback(() => {
    if (urlWasReplaced) router.push("/library");
    else router.back();
  }, [urlWasReplaced, router]);

  // Swaps to a sibling chapter in place — updates `id` state (re-triggering
  // the fetch effect above) instead of navigating, so the cover hero, back
  // button, and chapters row never unmount/reflow. meta.seriesId stays the
  // same across chapters, so the chapters-row effect below doesn't re-fetch.
  const switchChapter = useCallback((newId: string) => {
    if (newId === id) return;
    setPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setStoryAudioUrl(null);
    setId(newId);
    window.history.replaceState(null, "", `/library/classics/${newId}`);
    setUrlWasReplaced(true);
  }, [id]);

  // Sibling chapters — only fetched when this classic is part of a series.
  const [chapters, setChapters] = useState<LibraryEntry[]>([]);
  useEffect(() => {
    if (!meta?.seriesId) { setChapters([]); return; }
    fetch(`/api/library?seriesId=${encodeURIComponent(meta.seriesId)}`)
      .then((r) => r.json())
      .then((data) => setChapters(Array.isArray(data) ? data : []))
      .catch(() => setChapters([]));
  }, [meta?.seriesId]);

  // Same key the home page uses to track which child profile is active —
  // favorites are scoped per-child, matching how child_ids scopes stories.
  useEffect(() => {
    setActiveChildId(typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null);
  }, []);

  const isFavorited = !!(activeChildId && favoritedBy.includes(activeChildId));

  const handleToggleFavorite = useCallback(async () => {
    if (!activeChildId || favoriteBusy) return;
    const nextFavorited = !isFavorited;
    setFavoriteBusy(true);
    setFavoritedBy((prev) => nextFavorited ? [...prev, activeChildId] : prev.filter((c) => c !== activeChildId));
    try {
      const res = await fetch(`/api/library/${id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: activeChildId, favorited: nextFavorited }),
      });
      if (!res.ok) throw new Error("failed");
      const { favoritedBy: updated } = await res.json() as { favoritedBy: string[] };
      setFavoritedBy(updated);
    } catch {
      setFavoritedBy((prev) => isFavorited ? [...prev, activeChildId] : prev.filter((c) => c !== activeChildId));
    } finally {
      setFavoriteBusy(false);
    }
  }, [activeChildId, favoriteBusy, isFavorited, id]);

  const handleOpenShare = useCallback(() => {
    if (allChildren.length === 0) {
      fetch("/api/child-profiles").then((r) => r.json()).then((d) => {
        if (Array.isArray(d)) setAllChildren(d as DBChildProfile[]);
      }).catch(() => {});
    }
    setShareOpen(true);
  }, [allChildren.length]);

  const handleOpenInStudio = useCallback(async () => {
    if (!meta || !blocks) return;
    setOpeningInStudio(true);
    const summary = getClassicSummary(meta.tagline, blocks);
    // Admin-added classics (UUID IDs) are editable in-place; hardcoded classics fork.
    // Either way, a classic can have real produced audio -- whether editing it
    // touches the original row or forks a copy is a separate question from
    // whether there's something worth hearing, so always carry the audio over
    // (see the equivalent note in library/[id]/page.tsx's handleEdit).
    writeDraft({
      promptText: `${meta.title} — ${meta.tagline}`,
      scriptBlocks: blocks,
      summary,
      coverPrompt: "",
      coverUrl: meta.coverUrl ?? "",
      editingStoryId: isHardcoded ? undefined : id,
      characterAvatars: {},
      storyTitle: meta.title,
      language: storyLanguage,
      characterProfiles,
      audioUrl: storyAudioUrl ?? undefined,
      durationSeconds: meta.durationSeconds,
    }, "nightstory_studio2_draft_v1");
    router.push("/studio?tab=script");
  }, [meta, blocks, router, storyLanguage, characterProfiles, isHardcoded, id, storyAudioUrl]);

  const toggleSummaryPlay = useCallback(async () => {
    if (summaryPlaying) {
      summaryAudioRef.current?.pause();
      setSummaryPlaying(false);
      return;
    }
    if (!blocks || !meta) return;
    const summary = getClassicSummary(meta.tagline, blocks);
    if (!summary) return;

    // Reuse cached audio URL from this session (survives component remounts)
    const sessionCached = summaryAudioCache.get(id);
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
        body: JSON.stringify({ text: summary, cacheKey: `classic-${id}` }),
      });
      const { audioUrl } = await res.json() as { audioUrl: string };
      summaryAudioCache.set(id, audioUrl);
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
  }, [summaryPlaying, blocks, meta, id]);

  if (loading) {
    return (
      <div className="cosmic-page min-h-full flex items-center justify-center">
        <span className="text-white/55 text-fs-body animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="cosmic-page min-h-full flex flex-col items-center justify-center gap-4">
        <span className="text-fs-display">✨</span>
        <p className="text-white/55 text-fs-body">Classic not found.</p>
        <button onClick={goBack} className="text-fs-body" style={{ color: "rgba(79,195,247,0.5)" }}>
          Go back
        </button>
      </div>
    );
  }

  const [c1, c2] = cardPalette(meta.title);
  const isReady = meta.status === "ready" && !!blocks;
  const showCoverImg = !!meta.coverUrl && !imgFailed;

  return (
    <div className="cosmic-page min-h-full">
      {storyAudioUrl && (
        <audio
          ref={storyAudioRef}
          src={storyAudioUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); markPause(); }}
          onEnded={() => { setPlaying(false); setCurrentTime(0); markEnded(); }}
          onTimeUpdate={() => { setCurrentTime(storyAudioRef.current?.currentTime ?? 0); markTick(); }}
          onLoadedMetadata={() => { setAudioDuration(storyAudioRef.current?.duration ?? 0); applyResumeSeek(); }}
        />
      )}

      <div className="pb-64">
        {/* Cover area — the book floats on this same atmospheric backdrop,
            matching the "casting onto a dark background" look used
            everywhere else this treatment appears. */}
        <div className="relative overflow-hidden" style={{ flexShrink: 0, height: 340 }}>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `radial-gradient(ellipse 70% 60% at 50% 35%, ${c1}28 0%, transparent 65%),
                linear-gradient(180deg,#060a18 0%,#0d1a3a 50%,#05080f 100%)`,
            }}
          >
            {!showCoverImg && (
              <span className="text-8xl" style={{ filter: `drop-shadow(0 0 32px ${c1}66)` }}>
                {meta.emoji}
              </span>
            )}
          </div>

          {showCoverImg && (
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 32, width: 198, height: 282 }}>
              <BookCover coverUrl={meta.coverUrl!} alt="" borderRadius={12} onImgError={() => setImgFailed(true)} />
            </div>
          )}

          {/* Gradient fade to page bg */}
          <div
            className="absolute bottom-0 left-0 right-0 h-24"
            style={{ background: "linear-gradient(to bottom, transparent, #05080F)" }}
          />

          {/* Back button */}
          <button
            onClick={goBack}
            aria-label="Back"
            className="absolute top-12 left-4 w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.16)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <Icon name="back" size={20} className="text-white" />
          </button>
        </div>

        {/* Title block — intentionally distinctive vs My Stories */}
        <div className="px-5 pt-2 pb-1">
          {/* Classics badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${c1}55, transparent)` }} />
            <span
              className="text-fs-body font-bold tracking-[0.2em] uppercase px-2.5 py-0.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${c1}18, ${c2}18)`,
                border: `1px solid ${c1}44`,
                color: c1,
              }}
            >
              ✨ Classic
            </span>
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${c2}55)` }} />
          </div>

          {/* Title with gradient */}
          <h1
            className="text-fs-display font-bold tracking-tight leading-tight mb-2"
            style={{
              background: `linear-gradient(135deg, #ffffff 0%, ${c1} 55%, ${c2} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: `drop-shadow(0 0 20px ${c1}44)`,
            }}
          >
            {meta.chapterCount && meta.chapterCount > 1 ? seriesDisplayTitle(meta.title) : meta.title}
          </h1>

          <p className="text-fs-caption font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
            Id = {id}
          </p>
        </div>

        {/* Divider */}
        <div className="mx-5 my-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Chapter list — only shown for classics that are part of a series.
            Horizontal row of small cover cards (Netflix "episodes" style) —
            a spread of cover thumbnails reads at a glance which chapter is
            which, instead of relying on title text alone. */}
        {chapters.length > 1 && (
          <div className="mb-5">
            <p className="text-fs-body font-bold uppercase tracking-widest mb-2.5 px-5" style={{ color: `${c1}bb` }}>
              Chapters
            </p>
            <div className="flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
              {chapters.map((c) => {
                const isCurrent = c.id === id;
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
                      border: isCurrent ? `2px solid ${c1}` : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: isCurrent ? `0 0 16px ${c1}55` : "0 4px 14px rgba(0,0,0,0.4)",
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
                      style={{ background: isCurrent ? c1 : "rgba(5,8,20,0.75)", color: isCurrent ? "#04101a" : "rgba(255,255,255,0.75)", backdropFilter: "blur(4px)" }}
                    >
                      {c.chapterNumber ?? "–"}
                    </span>
                    {isCurrent && (
                      <span className="absolute top-1.5 right-1.5 text-fs-body" style={{ color: c1 }}>▶</span>
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

        {/* Story summary — the tagline used to be shown redundantly right above
            this same card (right under the title) as a second, separate
            summary; this is now the only one, so remove the duplicate above
            instead of showing the same story described twice in a row. */}
        {isReady && (() => {
          const classicSummary = getClassicSummary(meta.tagline, blocks!);
          if (!classicSummary) return null;
          const LIMIT = 220;
          const long = classicSummary.length > LIMIT;
          const shown = !summaryExpanded && long ? classicSummary.slice(0, LIMIT).trimEnd() : classicSummary;
          return (
            <div
              className="mx-5 mb-5 px-4 py-3.5 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${c1}0a, ${c2}0a)`,
                border: `1px solid ${c1}28`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-fs-body font-bold tracking-[0.18em] uppercase"
                  style={{ color: `${c1}bb` }}
                >
                  Story
                </p>
                <button
                  onClick={toggleSummaryPlay}
                  disabled={summaryLoading}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-fs-body font-medium transition-all active:scale-95"
                  style={summaryPlaying
                    ? { background: `${c1}28`, border: `1px solid ${c1}55`, color: c1 }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                  }
                >
                  {summaryPlaying ? <Icon name="pause" size={11} /> : summaryLoading ? "…" : <Icon name="play" size={11} />}
                  <span>{summaryPlaying ? "Stop" : summaryLoading ? "Loading" : "Play"}</span>
                </button>
              </div>
              <p style={{ fontSize: "var(--fs-body)", lineHeight: "1.7", color: "rgba(255,255,255,0.85)", fontWeight: 400 }}>
                {shown}
                {long && !summaryExpanded && (
                  <button
                    onClick={() => setSummaryExpanded(true)}
                    className="ml-1 font-semibold"
                    style={{ color: "#4fc3f7", fontSize: "var(--fs-label)" }}
                  >
                    … more
                  </button>
                )}
              </p>
            </div>
          );
        })()}

        {/* Favorite + Share row — every classic has a real stories row (created
            the moment its script is generated), so this works the same for
            hardcoded and admin-added classics. Share needs actual audio to
            point to, so it only appears once the story has been produced. */}
        {isReady && (
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
            {storyAudioUrl && (
              <button
                onClick={handleOpenShare}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-fs-body font-semibold transition-all active:scale-90"
                style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}
              >
                <Icon name="share" size={16} />
                <span>Share</span>
              </button>
            )}
          </div>
        )}

        {shareOpen && meta && (
          <ShareSheet
            story={{
              id,
              title: meta.title,
              summary: getClassicSummary(meta.tagline, blocks ?? []),
              coverUrl: meta.coverUrl,
              durationSeconds: meta.durationSeconds ?? 0,
              createdAt: 0,
              blocks: blocks ?? [],
              isClassic: true,
              language: storyLanguage ?? meta.language,
            } as LibraryEntry}
            children={allChildren}
            onClose={() => setShareOpen(false)}
          />
        )}

        {/* Cast panel — read-only */}
        {isReady && blocks!.length > 0 && (
          <div className="mt-4 mb-1">
            <ReadOnlyCastPanel blocks={blocks!} characterAvatars={characterAvatars} />
          </div>
        )}

        {/* Moral lessons panel — same presentation as Studio's collapsed view, read-only */}
        {moralLessons && moralLessons.length > 0 && (
          <div className="mt-4 px-5">
            <ReadOnlyLessonsPanel moralLessons={moralLessons} storyLanguage={storyLanguage} />
          </div>
        )}

        {/* Script panel — same component, look, and functionality as Studio's */}
        {isReady ? (
          <div className="px-5">
            <ScriptTab
              blocks={blocks!}
              voices={voicePool}
              onBlocksChange={setBlocks}
              onProduce={() => {}}
              isProducing={false}
              characterAvatars={characterAvatars}
              storyId={meta.id}
              scenes={scenes}
              totalDurationSeconds={meta.durationSeconds}
              readOnlyScript
              hideDurationPicker
              hideProduceButton
              hideDirectorsNote
            />
          </div>
        ) : (
          <div className="px-5 flex flex-col items-center gap-3 py-10">
            {meta.status === "pending" || meta.status === "generating" ? (
              <>
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${c1} transparent transparent transparent` }}
                />
                <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {meta.status === "generating" ? "Generating script…" : "Preparing this classic…"}
                </p>
              </>
            ) : (
              <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.52)" }}>Script unavailable.</p>
            )}
          </div>
        )}

        {/* Open in Studio button — admin only, since classics aren't the user's own story */}
        {isAdmin && (
          <div className="px-5 mt-8 mb-4">
            <button
              onClick={handleOpenInStudio}
              disabled={!isReady || openingInStudio}
              className="w-full py-3.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={isReady && !openingInStudio ? {
                background: `linear-gradient(135deg, ${c1}18, ${c2}18)`,
                border: `1px solid ${c1}44`,
                color: c1,
              } : {
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.40)",
              }}
            >
              <span>🎬</span>
              <span>{openingInStudio ? "Opening…" : "Open in Studio"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Sticky audio player — constrained to app width */}
      <div
        className="fixed bottom-0 left-0 right-0 pt-6"
        style={{ background: "linear-gradient(to top, #05080F 70%, transparent)", zIndex: 40 }}
      >
        <div className="mx-auto px-4 pb-20" style={{ maxWidth: stickyMaxWidth }}>
          {storyAudioUrl ? (
            <div
              className="rounded-2xl px-4 py-3.5"
              style={{ background: "rgba(5,8,20,0.92)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(20px)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={handlePlayPause}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-fs-heading flex-shrink-0 active:scale-95 transition-transform"
                  style={{ background: "rgba(79,195,247,0.14)", border: "1.5px solid rgba(79,195,247,0.45)", boxShadow: "0 0 14px rgba(79,195,247,0.3)" }}
                >
                  {playing ? <Icon name="pause" size={20} /> : <Icon name="play" size={20} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-fs-body font-medium truncate leading-snug">{meta.title}</p>
                  <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.52)" }}>✨ Classic story</p>
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
                  max={audioDuration || (meta.durationSeconds ?? 180)}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 cursor-pointer"
                  style={{ accentColor: "#4fc3f7" }}
                />
                <span className="text-fs-body w-8 flex-shrink-0" style={{ color: "rgba(255,255,255,0.52)" }}>
                  {formatTime(audioDuration || (meta.durationSeconds ?? 180))}
                </span>
              </div>
            </div>
          ) : producing ? (
            <div
              className="rounded-2xl px-4 py-4"
              style={{ background: "rgba(5,8,20,0.92)", border: `1px solid ${c1}33`, backdropFilter: "blur(20px)" }}
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0 animate-spin"
                  style={{ border: `1.5px solid ${c1}44`, borderTopColor: c1 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-fs-body font-medium truncate">{produceStep}</p>
                  <p className="text-fs-body truncate" style={{ color: `${c1}88` }}>Producing "{meta.title}"…</p>
                </div>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${produceProgress}%`, background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                />
              </div>
            </div>
          ) : isReady ? (
            <button
              onClick={handleProduceAudio}
              className="w-full py-3.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${c1}22, ${c2}22)`,
                border: `1px solid ${c1}55`,
                color: c1,
                backdropFilter: "blur(20px)",
              }}
            >
              <span>🎙️</span>
              <span>Generate & play audio story</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
