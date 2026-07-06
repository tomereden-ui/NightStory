"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { writeDraft } from "@/lib/draftStore";
import { useViewMode } from "@/context/ViewModeContext";
import type { ClassicMeta } from "@/lib/classicStories";
import { CLASSIC_STORIES } from "@/lib/classicStories";
import type { ScriptBlock, StoryScene, Voice } from "@/types";
import Icon from "@/components/ui/Icon";
import ReadOnlyCastPanel from "@/components/story/ReadOnlyCastPanel";
import ScriptTab from "@/components/studio/ScriptTab";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import { fetchBankAvatars, resolveCharacterAvatar, type CharacterType } from "@/lib/services/characterAvatars";
import ShareSheet from "@/components/ShareSheet";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import { useListeningProgress } from "@/hooks/useListeningProgress";

// Persists summary audio URLs across component mounts within a session
const summaryAudioCache = new Map<string, string>();

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  return source
    .slice(0, 3)
    .map((b) => b.textPayload.replace(/^\[.*?\]\s*/, ""))
    .join(" ");
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
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { effective } = useViewMode();
  const stickyMaxWidth = effective === "desktop" ? 896 : effective === "tablet" ? 672 : 448;

  const [meta, setMeta] = useState<ClassicMeta | null>(null);
  const [blocks, setBlocks] = useState<ScriptBlock[] | null>(null);
  const [scenes, setScenes] = useState<StoryScene[]>([]);
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
  const [uploadingCover, setUploadingCover] = useState(false);
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
        const type: CharacterType = name.toLowerCase().includes("narrat") ? "narrator" : "adult";
        avatars[name] = resolveCharacterAvatar(name, type, bank, voicePool);
      }
      setCharacterAvatars(avatars);
    })();
    return () => { cancelled = true; };
  }, [blocks, voicePool]);
  const [summaryPlaying, setSummaryPlaying] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const summary = deriveClassicSummary(blocks);
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
    }).finally(() => setLoading(false));
  }, [id]);

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
    const summary = deriveClassicSummary(blocks) || meta.tagline;
    // Admin-added classics (UUID IDs) are editable in-place; hardcoded classics fork.
    writeDraft({
      promptText: `${meta.title} — ${meta.tagline}`,
      scriptBlocks: blocks,
      summary,
      coverPrompt: "",
      coverUrl: meta.coverUrl ?? "",
      editingStoryId: isHardcoded ? undefined : id,
      characterAvatars: {},
      storyTitle: meta.title,
    }, "nightstory_studio2_draft_v1");
    router.push("/studio2");
  }, [meta, blocks, router]);

  const toggleSummaryPlay = useCallback(async () => {
    if (summaryPlaying) {
      summaryAudioRef.current?.pause();
      setSummaryPlaying(false);
      return;
    }
    if (!blocks) return;
    const summary = deriveClassicSummary(blocks);
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
  }, [summaryPlaying, blocks, id]);

  const handleUploadCover = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/classics/${id}/cover`, { method: "POST", body: fd });
      if (res.ok) {
        const { coverUrl } = await res.json() as { coverUrl: string };
        setMeta((m) => m ? { ...m, coverUrl } : m);
        setImgFailed(false);
      }
    } catch {
      // silently ignore
    } finally {
      setUploadingCover(false);
    }
  };

  if (loading) {
    return (
      <div className="cosmic-page min-h-full flex items-center justify-center">
        <span className="text-white/30 text-fs-body animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="cosmic-page min-h-full flex flex-col items-center justify-center gap-4">
        <span className="text-fs-display">✨</span>
        <p className="text-white/30 text-fs-body">Classic not found.</p>
        <button onClick={() => router.back()} className="text-fs-body" style={{ color: "rgba(79,195,247,0.5)" }}>
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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

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
        {/* Cover area */}
        <div className="relative h-52 overflow-hidden" style={{ flexShrink: 0 }}>
          {showCoverImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.coverUrl}
              alt=""
              className="w-full h-full object-cover ken-burns"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 50% 35%, ${c1}28 0%, transparent 65%),
                  linear-gradient(180deg,#060a18 0%,#0d1a3a 50%,#05080f 100%)`,
              }}
            >
              <span className="text-8xl" style={{ filter: `drop-shadow(0 0 32px ${c1}66)` }}>
                {meta.emoji}
              </span>
            </div>
          )}

          {/* Gradient fade to page bg */}
          <div
            className="absolute bottom-0 left-0 right-0 h-24"
            style={{ background: "linear-gradient(to bottom, transparent, #05080F)" }}
          />

          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-12 left-4 w-8 h-8 flex items-center justify-center rounded-full"
            style={{
              background: "rgba(5,8,20,0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Icon name="back" size={18} className="text-white/60" />
          </button>

          {/* Cover action buttons */}
          <div className="absolute top-12 right-4 flex items-center gap-1.5">
            {/* Manual upload */}
            {!uploadingCover ? (
              <button
                onClick={handleUploadCover}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-fs-body font-medium transition-all active:scale-95"
                style={{
                  background: "rgba(5,8,20,0.6)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                📷
              </button>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-fs-body"
                style={{ background: "rgba(5,8,20,0.6)", color: "rgba(255,255,255,0.3)" }}
              >
              <div
                className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                style={{ borderColor: `${c1} transparent transparent transparent` }}
              />
              Uploading…
              </div>
            )}
          </div>
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
            {meta.title}
          </h1>

          <p className="text-fs-body leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            {meta.tagline}
          </p>

          <p className="text-fs-caption font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
            Id = {id}
          </p>
        </div>

        {/* Divider */}
        <div className="mx-5 my-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Story summary — derived from opening narrator lines */}
        {isReady && (() => {
          const classicSummary = deriveClassicSummary(blocks!);
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
                <span style={{ fontSize: "var(--fs-heading)", lineHeight: 1 }}>📤</span>
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
              summary: blocks ? deriveClassicSummary(blocks) : meta.tagline,
              coverUrl: meta.coverUrl,
              durationSeconds: meta.durationSeconds ?? 0,
              createdAt: 0,
              blocks: blocks ?? [],
              isClassic: true,
            } as LibraryEntry}
            children={allChildren}
            onClose={() => setShareOpen(false)}
          />
        )}

        {/* Cast panel — read-only */}
        {isReady && blocks!.length > 0 && (
          <div className="mt-4 mb-1">
            <ReadOnlyCastPanel blocks={blocks!} />
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
                <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {meta.status === "generating" ? "Generating script…" : "Preparing this classic…"}
                </p>
              </>
            ) : (
              <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>Script unavailable.</p>
            )}
          </div>
        )}

        {/* Open in Studio button */}
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
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <span>🎬</span>
            <span>{openingInStudio ? "Opening…" : "Open in Studio"}</span>
          </button>
        </div>
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
                  <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.3)" }}>✨ Classic story</p>
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
                  max={audioDuration || (meta.durationSeconds ?? 180)}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 cursor-pointer"
                  style={{ accentColor: "#4fc3f7" }}
                />
                <span className="text-fs-body w-8 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
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
