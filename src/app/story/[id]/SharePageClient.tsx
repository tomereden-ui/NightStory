"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PublicStoryData } from "@/app/api/story/[id]/route";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function StarField() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    x: (i * 137.5) % 100,
    y: (i * 79.3) % 100,
    r: 0.5 + (i % 3) * 0.4,
    op: 0.2 + (i % 5) * 0.12,
  }));
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.op} />
      ))}
    </svg>
  );
}

function ChildBubble({ child }: { child: { name: string; avatarEmoji: string } }) {
  const isUrl = child.avatarEmoji.startsWith("http");
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
        style={{
          width: 72, height: 72,
          background: "linear-gradient(135deg,#4fc3f7,#f59e0b,#a78bfa)",
          padding: 2.5,
          boxShadow: "0 0 24px rgba(79,195,247,0.4), 0 0 48px rgba(79,195,247,0.15)",
        }}
      >
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: "#0a1628" }}>
          {isUrl
            ? <img src={child.avatarEmoji} alt={child.name} className="w-full h-full object-cover" />
            : <span style={{ fontSize: 36, lineHeight: 1 }}>{child.avatarEmoji}</span>
          }
        </div>
      </div>
      <span className="text-white font-bold" style={{ fontSize: "var(--fs-subtitle)" }}>{child.name}</span>
    </div>
  );
}

export default function SharePageClient({ storyId }: { storyId: string }) {
  const [story, setStory]     = useState<PublicStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);

  useEffect(() => {
    fetch(`/api/story/${storyId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setStory(d as PublicStoryData))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [storyId]);

  const handlePlayPause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  }, [playing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040612" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)" }}>Loading story…</p>
        </div>
      </div>
    );
  }

  if (notFound || !story) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ background: "#040612" }}>
        <span style={{ fontSize: 64 }}>🌙</span>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)" }}>Story not found.</p>
        <a href="/" style={{ color: "#4fc3f7", fontSize: "var(--fs-body)" }}>Go to NightStory →</a>
      </div>
    );
  }

  const childNames = story.children.map((c) => c.name);
  const forLabel   = childNames.length === 0 ? null
    : childNames.length === 1 ? childNames[0]
    : childNames.slice(0, -1).join(", ") + " & " + childNames[childNames.length - 1];

  const durationMin = Math.round(story.durationSeconds / 60);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#040612" }}>
      {/* ── Atmospheric background ── */}
      {story.coverUrl && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${story.coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(48px) brightness(0.18) saturate(1.4)",
            transform: "scale(1.08)",
            zIndex: 0,
          }}
        />
      )}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,195,247,0.06) 0%, transparent 70%)",
        zIndex: 1,
      }} />
      <StarField />

      <audio
        ref={audioRef}
        src={story.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* ── Content ── */}
      <div className="relative flex flex-col items-center px-6 pt-16 pb-20" style={{ zIndex: 2 }}>

        {/* Cover art */}
        <div className="relative mb-6">
          {story.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={story.coverUrl}
              alt={story.title}
              className="object-cover"
              style={{
                width: 220, height: 220,
                borderRadius: 28,
                boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 80px rgba(79,195,247,0.12)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          ) : (
            <div style={{
              width: 220, height: 220, borderRadius: 28,
              background: "radial-gradient(ellipse at 40% 35%, rgba(79,195,247,0.25) 0%, rgba(10,6,24,0.9) 70%)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 72 }}>🌙</span>
            </div>
          )}

          {/* NightStory badge */}
          <div
            className="absolute flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              top: -10, left: "50%", transform: "translateX(-50%)",
              background: "rgba(5,8,20,0.85)",
              border: "1px solid rgba(79,195,247,0.3)",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 12 }}>🌙</span>
            <span style={{ color: "#4fc3f7", fontSize: "var(--fs-label)", fontWeight: 700, letterSpacing: 1 }}>NightStory</span>
          </div>
        </div>

        {/* Child avatars + for label */}
        {story.children.length > 0 && (
          <div className="flex flex-col items-center mb-6">
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              ✨ A story for
            </p>
            <div className="flex items-end justify-center" style={{ gap: story.children.length > 1 ? 20 : 0 }}>
              {story.children.map((child) => (
                <ChildBubble key={child.id} child={child} />
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <h1
          className="text-center font-bold mb-2"
          style={{
            fontSize: "var(--fs-title)",
            lineHeight: 1.2,
            background: "linear-gradient(135deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            maxWidth: 320,
            filter: "drop-shadow(0 0 20px rgba(79,195,247,0.3))",
          }}
        >
          {story.title}
        </h1>

        {/* Duration */}
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)", marginBottom: story.shareMessage ? 24 : 32 }}>
          ◷ {durationMin} min
        </p>

        {/* Personal message */}
        {story.shareMessage && (
          <div
            className="w-full mb-8"
            style={{
              maxWidth: 360,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "18px 22px",
            }}
          >
            <p style={{ color: "rgba(79,195,247,0.5)", fontSize: "var(--fs-label)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              💌 Message
            </p>
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: "var(--fs-body)", lineHeight: 1.7, fontStyle: "italic" }}>
              "{story.shareMessage}"
            </p>
          </div>
        )}

        {/* Play button */}
        <button
          onClick={handlePlayPause}
          className="flex items-center justify-center mb-6 transition-transform active:scale-95"
          style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg,rgba(79,195,247,0.2),rgba(167,139,250,0.2))",
            border: "2px solid rgba(79,195,247,0.55)",
            boxShadow: playing
              ? "0 0 48px rgba(79,195,247,0.55), 0 0 80px rgba(79,195,247,0.2)"
              : "0 0 28px rgba(79,195,247,0.3)",
            color: "#fff",
            fontSize: 32,
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-3 w-full mb-10" style={{ maxWidth: 360 }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)", width: 36, textAlign: "right", flexShrink: 0 }}>
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative" style={{ height: 4 }}>
            <div className="absolute inset-0 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: `${((currentTime / (duration || story.durationSeconds)) * 100).toFixed(1)}%`,
                background: "linear-gradient(90deg,#4fc3f7,#a78bfa)",
                transition: "width 0.5s linear",
              }}
            />
            <input
              type="range" min={0} max={duration || story.durationSeconds} step={0.5} value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)", width: 36, flexShrink: 0 }}>
            {formatTime(duration || story.durationSeconds)}
          </span>
        </div>

        {/* Summary */}
        {story.summary && (
          <p className="text-center mb-10" style={{
            color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)",
            lineHeight: 1.6, maxWidth: 320,
          }}>
            {story.summary}
          </p>
        )}

        {/* Divider */}
        <div style={{ width: "100%", maxWidth: 320, height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

        {/* CTA */}
        <a
          href="/"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl transition-all active:scale-95"
          style={{
            background: "rgba(79,195,247,0.08)",
            border: "1px solid rgba(79,195,247,0.25)",
            color: "#4fc3f7",
            fontSize: "var(--fs-body)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <span>🌙</span>
          <span>Create a story for your child</span>
          <span>→</span>
        </a>

        {forLabel && (
          <p className="mt-4 text-center" style={{ color: "rgba(255,255,255,0.15)", fontSize: "var(--fs-label)" }}>
            Made with love for {forLabel}
          </p>
        )}
      </div>
    </div>
  );
}
