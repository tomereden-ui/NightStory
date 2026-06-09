"use client";

import type { ScriptBlock, Voice } from "@/types";

interface SpeechPlayerModalProps {
  block: ScriptBlock;
  voice: Voice;
  isPlaying: boolean;
  isPaused: boolean;
  onPlayPause: () => void;
  onStop: () => void;
}

export default function SpeechPlayerModal({
  block,
  voice,
  isPlaying,
  isPaused,
  onPlayPause,
  onStop,
}: SpeechPlayerModalProps) {
  const isNarrator = block.characterName === "Narrator";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onStop}
      />

      {/* Floating player panel */}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50 rounded-3xl border border-white/10 shadow-glow overflow-hidden animate-float-up"
        style={{ background: "linear-gradient(160deg,#131729,#0E1225)" }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg,#8B5CF6,#EC4899,#00D4FF)" }} />

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {/* Character info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-bg-elevated border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
              {voice.avatarEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isNarrator ? "text-purple-bright/70" : "text-teal/70"}`}>
                {block.characterName}
              </p>
              <p className="text-white/40 text-[11px]">{voice.name} · {voice.style}</p>
            </div>
            {/* Sound bars animation */}
            <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    background: isPlaying && !isPaused ? "linear-gradient(180deg,#8B5CF6,#00D4FF)" : "rgba(255,255,255,0.15)",
                    height: isPlaying && !isPaused ? undefined : "4px",
                    animation: isPlaying && !isPaused ? `bounce 0.6s ease-in-out ${(i - 1) * 0.12}s infinite` : "none",
                    minHeight: "4px",
                    maxHeight: "20px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Block text */}
          <p className="text-white/75 text-sm leading-relaxed line-clamp-4">
            {block.textPayload}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              onClick={onPlayPause}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 16px rgba(139,92,246,0.4)" }}
            >
              {isPaused ? "▶ Resume" : isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            {/* Stop / Close */}
            <button
              onClick={onStop}
              className="w-12 h-12 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all text-lg"
              title="Stop and close"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
