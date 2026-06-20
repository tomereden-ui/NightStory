"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { writeDraft } from "@/lib/draftStore";
import { useViewMode } from "@/context/ViewModeContext";
import type { LibraryEntry } from "@/lib/libraryStore";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const cachedAudioUrlRef = useRef<string | null>(null);
  const [summaryPlaying, setSummaryPlaying] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [scriptExpanded, setScriptExpanded] = useState(false);

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

    // Reuse cached audio from this session
    if (cachedAudioUrlRef.current) {
      const audio = new Audio(cachedAudioUrlRef.current);
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
      cachedAudioUrlRef.current = audioUrl;
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

  const handleEdit = useCallback(() => {
    if (!entry) return;
    writeDraft({
      promptText: "",
      scriptBlocks: entry.blocks,
      summary: entry.summary,
      coverPrompt: "",
      coverUrl: entry.coverUrl ?? "",
      editingStoryId: entry.id,
      storyTitle: entry.title,
    });
    router.push("/studio");
  }, [entry, router]);

  if (loading) {
    return (
      <div className="cosmic-page min-h-full flex items-center justify-center">
        <span className="text-white/30 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="cosmic-page min-h-full flex flex-col items-center justify-center gap-4">
        <span className="text-4xl">🌙</span>
        <p className="text-white/30 text-sm">Story not found.</p>
        <button onClick={() => router.back()} className="text-xs" style={{ color: "rgba(79,195,247,0.5)" }}>Go back</button>
      </div>
    );
  }

  return (
    <div className="cosmic-page min-h-full">
      <audio
        ref={audioRef}
        src={entry.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      <div className="pb-52">
        {/* Atmospheric cover area */}
        <div className="relative h-52 overflow-hidden" style={{ flexShrink: 0 }}>
          {entry.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover" />
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
            <span className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(79,195,247,0.7)" }}>
              Now Playing
            </span>
          </div>
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-12 left-4 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "rgba(5,8,20,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <span className="text-white/60 text-sm">←</span>
          </button>
        </div>

        {/* Title — big, prominent */}
        <div className="px-5 mt-4 mb-1">
          <h1
            className="text-2xl font-bold tracking-tight leading-tight mb-1"
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
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            {timeAgo(entry.createdAt)} · {Math.round(entry.durationSeconds / 60)} min
          </p>
        </div>

        {/* Summary card */}
        {entry.summary && (
          <div className="mx-5 mt-3 mb-1 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.45)" }}>Story</p>
              <button
                onClick={toggleSummaryPlay}
                disabled={summaryLoading}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all active:scale-95"
                style={summaryPlaying
                  ? { background: "rgba(79,195,247,0.18)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                  : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                }
              >
                <span>{summaryPlaying ? "⏸" : summaryLoading ? "…" : "▶"}</span>
                <span>{summaryPlaying ? "Stop" : summaryLoading ? "Loading" : "Play"}</span>
              </button>
            </div>
            {(() => {
              const LIMIT = 220;
              const long = entry.summary.length > LIMIT;
              const shown = !summaryExpanded && long ? entry.summary.slice(0, LIMIT).trimEnd() : entry.summary;
              return (
                <p style={{ fontSize: "13.5px", lineHeight: "1.7", color: "rgba(255,255,255,0.85)", fontWeight: 400 }}>
                  {shown}
                  {long && !summaryExpanded && (
                    <button onClick={() => setSummaryExpanded(true)} className="ml-1 font-semibold" style={{ color: "#4fc3f7", fontSize: "12px" }}>
                      … more
                    </button>
                  )}
                </p>
              );
            })()}
          </div>
        )}

        {/* Divider */}
        <div className="mx-5 my-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Script toggle */}
        <div className="px-5 mb-3">
          <button
            onClick={() => setScriptExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all active:scale-[0.98]"
            style={{
              background: scriptExpanded ? "rgba(79,195,247,0.08)" : "rgba(255,255,255,0.04)",
              border: scriptExpanded ? "1px solid rgba(79,195,247,0.2)" : "1px solid rgba(255,255,255,0.07)",
              color: scriptExpanded ? "rgba(79,195,247,0.7)" : "rgba(255,255,255,0.3)",
            }}
          >
            <span>{scriptExpanded ? "Hide script" : "View full script"}</span>
            <span
              className="transition-transform duration-200"
              style={{ display: "inline-block", transform: scriptExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            >▾</span>
          </button>
        </div>

        {/* Script blocks — on demand */}
        {scriptExpanded && (
          <div className="px-5 flex flex-col gap-3">
            {entry.blocks.map((block) => {
              const isNarrator = block.characterName.toLowerCase().includes("narrat");
              const isSfx = block.characterName === "SFX";
              if (isSfx) return null;
              return (
                <div key={block.id}>
                  {!isNarrator && (
                    <p
                      className="text-[9px] font-semibold uppercase tracking-widest mb-1 ml-3"
                      style={{ color: "rgba(79,195,247,0.72)" }}
                    >
                      {block.characterName}
                    </p>
                  )}
                  <div
                    className="px-4 py-3 rounded-xl"
                    style={isNarrator ? {
                      color: "rgba(255,255,255,0.45)",
                      fontStyle: "italic",
                      fontSize: "11px",
                      lineHeight: "1.6",
                    } : {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderLeft: "2px solid rgba(79,195,247,0.3)",
                      color: "rgba(255,255,255,0.82)",
                      fontSize: "11.5px",
                      lineHeight: "1.6",
                    }}
                  >
                    {block.textPayload.replace(/^\[.*?\]\s*/, "")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Open in Studio button */}
        <div className="px-5 mt-8 mb-4">
          <button
            onClick={handleEdit}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: "rgba(79,195,247,0.1)",
              border: "1px solid rgba(79,195,247,0.3)",
              color: "rgba(79,195,247,0.9)",
            }}
          >
            <span>🎬</span>
            <span>Open in Studio</span>
          </button>
        </div>
      </div>

      {/* Sticky player bar — constrained to app width */}
      <div
        className="fixed bottom-0 left-0 right-0 pt-6"
        style={{ background: "linear-gradient(to top, #05080F 70%, transparent)" }}
      >
        <div className="mx-auto px-4 pb-8" style={{ maxWidth: stickyMaxWidth }}>
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
                className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 active:scale-95 transition-transform"
                style={{
                  background: "rgba(79,195,247,0.14)",
                  border: "1.5px solid rgba(79,195,247,0.45)",
                  boxShadow: "0 0 14px rgba(79,195,247,0.3)",
                }}
              >
                {playing ? "⏸" : "▶"}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate leading-snug">{entry.title}</p>
                {entry.summary && (
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {entry.summary.split(" ").slice(0, 6).join(" ")}…
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] w-8 text-right flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
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
              <span className="text-[10px] w-8 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                {formatTime(duration || entry.durationSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
