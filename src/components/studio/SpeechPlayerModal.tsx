"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ScriptBlock, Voice } from "@/types";

interface SpeechPlayerModalProps {
  block: ScriptBlock;
  voice: Voice;
  isPlaying: boolean;
  isPaused: boolean;
  speechError?: string | null;
  onPlayPause: () => void;
  onStop: () => void;
}

export default function SpeechPlayerModal({
  block,
  voice,
  isPlaying,
  isPaused,
  speechError,
  onPlayPause,
  onStop,
}: SpeechPlayerModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const soundActive = isPlaying && !isPaused;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 9998 }}
        onClick={onStop}
      />

      {/* Floating panel */}
      <div
        className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "#111520",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          zIndex: 9999,
        }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg,#00D4FF,#8B5CF6,#EC4899)" }} />

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {/* Character info */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {voice.avatarEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: soundActive ? "#00D4FF" : "rgba(255,255,255,0.4)" }}>
                {block.characterName}
              </p>
              <p className="text-white/35 text-[11px]">{voice.name} · {voice.style}</p>
            </div>
            {/* Sound bars */}
            <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    background: soundActive ? "linear-gradient(180deg,#00D4FF,#0088AA)" : "rgba(255,255,255,0.12)",
                    height: soundActive ? undefined : "4px",
                    animation: soundActive ? `bounce 0.6s ease-in-out ${(i - 1) * 0.12}s infinite` : "none",
                    minHeight: "4px",
                    maxHeight: "20px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Error banner */}
          {speechError && (
            <div
              className="px-3 py-2 rounded-xl text-xs leading-relaxed"
              style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}
            >
              ⚠ {speechError}
            </div>
          )}

          {/* Block text */}
          <p className="text-white/65 text-sm leading-relaxed line-clamp-4">
            {block.textPayload}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={onPlayPause}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: "linear-gradient(90deg,#00D4FF,#00A8C8)",
                color: "#0A0C14",
                boxShadow: "0 4px 16px rgba(0,212,255,0.3)",
              }}
            >
              {isPaused ? "▶ Resume" : isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={onStop}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all text-lg"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
