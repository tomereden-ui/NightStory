"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ScriptBlock, Voice } from "@/types";
import VoiceAvatar from "@/components/ui/VoiceAvatar";
import Icon from "@/components/ui/Icon";

interface SpeechPlayerModalProps {
  block: ScriptBlock;
  voice: Voice;
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  speechError?: string | null;
  onPlayPause: () => void;
  onStop: () => void;
}

export default function SpeechPlayerModal({
  block, voice, isLoading, isPlaying, isPaused, speechError, onPlayPause, onStop,
}: SpeechPlayerModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const soundActive = isPlaying && !isPaused;

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(5px)", zIndex: 9998 }}
        onClick={!isLoading ? onStop : undefined}
      />
      <div
        className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "rgba(8,12,24,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", zIndex: 9999 }}
      >
        {/* Top accent */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6,#EC4899)" }} />

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {/* Character header */}
          <div className="flex items-center gap-3">
            <VoiceAvatar avatarUrl={voice.avatarUrl} emoji={voice.avatarEmoji} size={40} borderColor="rgba(255,255,255,0.1)" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: soundActive ? "#4fc3f7" : "rgba(255,255,255,0.4)" }}>
                {block.characterName}
              </p>
              <p className="text-white/35 text-[11px]">{voice.name} · Gemini TTS</p>
            </div>
            {/* Sound bars or spinner */}
            {isLoading ? (
              <div className="flex gap-1 items-end h-5 flex-shrink-0">
                {[0,1,2,3].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#4fc3f7", animation: `bounce 0.6s ease-in-out ${i*0.12}s infinite` }} />
                ))}
              </div>
            ) : (
              <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
                {[1,2,3,4].map((i) => (
                  <span key={i} className="w-1 rounded-full"
                    style={{
                      background: soundActive ? "linear-gradient(180deg,#4fc3f7,#0088AA)" : "rgba(255,255,255,0.12)",
                      height: soundActive ? undefined : "4px",
                      animation: soundActive ? `bounce 0.6s ease-in-out ${(i-1)*0.12}s infinite` : "none",
                      minHeight: "4px", maxHeight: "20px",
                    }} />
                ))}
              </div>
            )}
          </div>

          {/* Status or error */}
          {isLoading && (
            <div className="text-center py-1">
              <p className="text-white/50 text-xs">Generating natural voice with Gemini AI…</p>
            </div>
          )}
          {speechError && !isLoading && (
            <div className="px-3 py-2 rounded-xl text-xs leading-relaxed"
              style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
              ⚠ {speechError}
            </div>
          )}

          {/* Block text */}
          {!isLoading && (
            <p className="text-white/65 text-sm leading-relaxed line-clamp-4">{block.textPayload}</p>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={onPlayPause}
              disabled={isLoading}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={isLoading ? {
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)",
              } : {
                background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
                color: "#05080F", boxShadow: "0 4px 16px rgba(79,195,247,0.3)",
              }}
            >
              {isLoading ? "Generating…" : isPaused ? <><Icon name="play" size={14} className="inline-block align-middle mr-1" />Resume</> : isPlaying ? <><Icon name="pause" size={14} className="inline-block align-middle mr-1" />Pause</> : <><Icon name="play" size={14} className="inline-block align-middle mr-1" />Play</>}
            </button>
            <button
              onClick={onStop}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
