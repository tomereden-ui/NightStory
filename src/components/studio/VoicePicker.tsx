"use client";

import { useEffect, useRef, useState } from "react";
import type { Voice } from "@/types";
import VoiceAvatar from "@/components/ui/VoiceAvatar";

// Mirrors HE_EL_VOICE_MAP in ttsService.ts — name only (no IDs needed client-side)
const HE_VOICE_NAMES: Record<string, string> = {
  Aoede:   "Rachel",
  Kore:    "Bella",
  Leda:    "Elli",
  Autonoe: "Domi",
  Charon:  "Adam",
  Fenrir:  "Arnold",
  Puck:    "Antoni",
  Orus:    "Josh",
  Zephyr:  "Sam",
};

interface VoicePickerProps {
  voices: Voice[];
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  onClose: () => void;
  /** Render as a static inline block (e.g. inside an expandable section) instead of a floating dropdown */
  inline?: boolean;
  /** ISO 639-1 language code of the story script — used to show which EL voice will actually play */
  storyLanguage?: string;
}

export default function VoicePicker({
  voices,
  selectedVoiceId,
  onSelect,
  onClose,
  inline = false,
  storyLanguage,
}: VoicePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const isHebrew = storyLanguage === "he";

  useEffect(() => {
    if (inline) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, inline]);

  // Stop any preview when the picker unmounts
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function togglePreview(e: React.MouseEvent, voice: Voice) {
    e.stopPropagation();
    if (!voice.previewUrl) return;
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = voice.previewUrl;
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.play().catch(() => setPlayingId(null));
    setPlayingId(voice.id);
  }

  // EL Hebrew-library voices are grouped separately from Gemini presets and the
  // user's cloned family voices.
  const hebrewVoices = voices.filter((v) => v.language === "he" && v.elevenLabsId);
  const familyVoices = voices.filter((v) => v.elevenLabsId && v.language !== "he");
  const presetVoices = voices.filter((v) => !v.elevenLabsId);

  function renderVoiceItem(voice: Voice) {
    const isSelected = voice.id === selectedVoiceId;
    const heElName = isHebrew && !voice.elevenLabsId ? (HE_VOICE_NAMES[voice.id] ?? null) : null;

    return (
      <li key={voice.id}>
        <button
          onClick={() => onSelect(voice.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${
            isSelected ? "bg-teal/10" : "hover:bg-white/5"
          }`}
        >
          <VoiceAvatar avatarUrl={voice.avatarUrl} emoji={voice.avatarEmoji} size={28} borderColor="rgba(79,195,247,0.2)" />
          <div className="flex-1 min-w-0">
            <p className={`text-fs-body font-semibold ${isSelected ? "text-teal" : "text-white/80"}`}>
              {voice.name}
            </p>
            <p className="text-fs-body text-white/25 capitalize">{voice.style}</p>
            {heElName && (
              <p className="text-fs-body" style={{ color: "rgba(167,139,250,0.7)" }}>
                עב: {heElName}
              </p>
            )}
          </div>
          {voice.previewUrl && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => togglePreview(e, voice)}
              className="flex-shrink-0 text-fs-body px-1.5 cursor-pointer"
              style={{ color: playingId === voice.id ? "#4fc3f7" : "rgba(255,255,255,0.35)" }}
              title="Preview voice"
            >
              {playingId === voice.id ? "⏸" : "▶"}
            </span>
          )}
          {isSelected && (
            <span className="text-teal text-fs-body flex-shrink-0">✓</span>
          )}
        </button>
      </li>
    );
  }

  const listContent = (
    <>
      {isHebrew && (
        <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(167,139,250,0.15)" }}>
          <p className="text-fs-body" style={{ color: "rgba(167,139,250,0.8)" }}>
            🇮🇱 עב = קול ElevenLabs בפועל
          </p>
          <a
            href="/admin/hebrew-voices"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fs-body"
            style={{ color: "rgba(79,195,247,0.7)", textDecoration: "underline" }}
            onClick={(e) => e.stopPropagation()}
          >
            שנה מיפוי
          </a>
        </div>
      )}
      <ul className="py-1 overflow-y-auto" style={{ maxHeight: inline ? 280 : "60vh" }}>
        {isHebrew && hebrewVoices.length > 0 && (
          <>
            <li className="px-3 pt-2 pb-1">
              <p className="text-fs-body uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>קולות עברית · ElevenLabs</p>
            </li>
            {hebrewVoices.map(renderVoiceItem)}
            <li className="px-3 pt-3 pb-1">
              <p className="text-white/20 text-fs-body uppercase tracking-widest">General</p>
            </li>
          </>
        )}
        {presetVoices.map(renderVoiceItem)}
        {familyVoices.length > 0 && (
          <>
            <li className="px-3 pt-3 pb-1">
              <p className="text-white/20 text-fs-body uppercase tracking-widest">Family Voices</p>
            </li>
            {familyVoices.map(renderVoiceItem)}
          </>
        )}
      </ul>
    </>
  );

  if (inline) {
    return (
      <div
        ref={ref}
        className="w-full rounded-2xl overflow-hidden"
        style={{
          background: "#0d1120",
          border: "1px solid rgba(79,195,247,0.15)",
        }}
      >
        {listContent}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 top-11 z-50 w-48 rounded-2xl flex flex-col shadow-card animate-float-up overflow-hidden"
      style={{
        background: "#111526",
        border: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(0,212,255,0.08)",
        maxHeight: "60vh",
      }}
    >
      <div className="px-3 py-2 border-b border-white/5 flex-shrink-0">
        <p className="text-white/30 text-fs-body uppercase tracking-widest">Assign Voice</p>
      </div>
      {listContent}
    </div>
  );
}
