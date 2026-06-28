"use client";

import { useEffect, useRef } from "react";
import type { Voice } from "@/types";
import VoiceAvatar from "@/components/ui/VoiceAvatar";

interface VoicePickerProps {
  voices: Voice[];
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  onClose: () => void;
}

export default function VoicePicker({
  voices,
  selectedVoiceId,
  onSelect,
  onClose,
}: VoicePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-11 z-50 w-48 rounded-2xl overflow-hidden shadow-card animate-float-up"
      style={{
        background: "#111526",
        border: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(0,212,255,0.08)",
      }}
    >
      <div className="px-3 py-2 border-b border-white/5">
        <p className="text-white/30 text-fs-body uppercase tracking-widest">Assign Voice</p>
      </div>

      <ul className="py-1">
        {voices.map((voice) => {
          const isSelected = voice.id === selectedVoiceId;
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
                  <p
                    className={`text-fs-body font-semibold ${
                      isSelected ? "text-teal" : "text-white/80"
                    }`}
                  >
                    {voice.name}
                  </p>
                  <p className="text-fs-body text-white/25 capitalize">{voice.style}</p>
                </div>
                {isSelected && (
                  <span className="text-teal text-fs-body flex-shrink-0">✓</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
