"use client";

import { useRef, useEffect, useState } from "react";
import type { ScriptBlock, Voice } from "@/types";
import VoicePicker from "./VoicePicker";

interface ScriptBlockCardProps {
  block: ScriptBlock;
  voices: Voice[];
  isPlaying: boolean;
  onTextChange: (id: string, text: string) => void;
  onVoiceChange: (id: string, voiceId: string) => void;
  onPlayPreview: (id: string) => void;
}

export default function ScriptBlockCard({
  block,
  voices,
  isPlaying,
  onTextChange,
  onVoiceChange,
  onPlayPreview,
}: ScriptBlockCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const assignedVoice = voices.find((v) => v.id === block.assignedVoiceId) ?? voices[0];
  const isNarrator = block.characterName === "Narrator";

  // Auto-resize textarea whenever content changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.textPayload]);

  return (
    <div
      className={`relative flex gap-3 p-3 rounded-2xl border transition-all duration-200 ${
        isFocused
          ? "bg-bg-elevated"
          : "bg-bg-card hover:border-white/10"
      }`}
      style={
        isFocused
          ? {
              borderColor: "rgba(79,195,247,0.4)",
              boxShadow: "0 0 0 1px rgba(79,195,247,0.1), 0 0 20px rgba(79,195,247,0.06)",
            }
          : { borderColor: "rgba(255,255,255,0.06)" }
      }
    >
      {/* Teal focus bar on the left edge */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-all duration-200"
        style={{
          background: isFocused
            ? "linear-gradient(180deg,#4fc3f7,#8B5CF6)"
            : "transparent",
        }}
      />

      {/* Voice avatar — tapping opens picker */}
      <div className="relative flex-shrink-0 pt-0.5">
        <button
          onClick={() => setShowPicker((p) => !p)}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-base border transition-all ${
            showPicker
              ? "border-teal bg-teal/15 shadow-teal-sm"
              : "border-bg-border bg-bg-elevated hover:border-teal/40"
          }`}
          aria-label={`Voice: ${assignedVoice.name}. Tap to change.`}
          title="Change voice"
        >
          {assignedVoice.avatarEmoji}
        </button>

        {showPicker && (
          <VoicePicker
            voices={voices}
            selectedVoiceId={block.assignedVoiceId}
            onSelect={(voiceId) => {
              onVoiceChange(block.id, voiceId);
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Text content area */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Character + voice labels */}
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest ${
              isNarrator ? "text-purple-bright/60" : "text-teal/70"
            }`}
          >
            {block.characterName}
          </span>
          <span className="text-white/15 text-[9px]">· {assignedVoice.name}</span>
        </div>

        {/* Inline editable, auto-resize textarea */}
        <textarea
          ref={textareaRef}
          value={block.textPayload}
          onChange={(e) => onTextChange(block.id, e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={1}
          placeholder="Enter dialogue or narration…"
          className="w-full bg-transparent text-white/85 text-sm leading-relaxed resize-none outline-none placeholder-white/15 overflow-hidden"
          style={{ minHeight: "22px" }}
        />
      </div>

      {/* Play preview button */}
      <button
        onClick={() => onPlayPreview(block.id)}
        className={`flex-shrink-0 self-start mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          isPlaying
            ? "border border-teal/60 bg-teal/15 shadow-teal-sm"
            : "border border-bg-border bg-bg-elevated hover:border-teal/40 hover:bg-teal/8"
        }`}
        aria-label={isPlaying ? "Playing preview" : "Preview this block"}
        title="5-second audio preview"
      >
        {isPlaying ? (
          <span className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 h-1.5 bg-teal rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" />
            <span className="w-0.5 h-3 bg-teal rounded-full animate-[bounce_0.6s_ease-in-out_0.15s_infinite]" />
            <span className="w-0.5 h-2 bg-teal rounded-full animate-[bounce_0.6s_ease-in-out_0.3s_infinite]" />
          </span>
        ) : (
          <span className="text-white/30 text-[10px] ml-px">▶</span>
        )}
      </button>
    </div>
  );
}
