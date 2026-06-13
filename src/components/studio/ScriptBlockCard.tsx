"use client";

import { useRef, useEffect, useState } from "react";
import type { ScriptBlock, Voice } from "@/types";
import VoicePicker from "./VoicePicker";

// ─── SFX payload helpers ──────────────────────────────────────────────────────

export function parseSfxPayload(textPayload: string): { description: string; durationSec: number } | null {
  const match = textPayload.match(/\[SFX:\s*(.+?)\s*\|\s*(\d+(?:\.\d+)?)s\]/i);
  if (!match) return null;
  return { description: match[1].trim(), durationSec: parseFloat(match[2]) };
}

export function buildSfxPayload(description: string, durationSec: number): string {
  return `[SFX: ${description} | ${durationSec}s]`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScriptBlockCardProps {
  block: ScriptBlock;
  voices: Voice[];
  isPlaying: boolean;
  onTextChange: (id: string, text: string) => void;
  onVoiceChange: (id: string, voiceId: string) => void;
  onPlayPreview: (id: string) => void;
  onDelete: (id: string) => void;
}

// ─── SFX card ─────────────────────────────────────────────────────────────────

function SfxCard({ block, onTextChange, onDelete }: Pick<ScriptBlockCardProps, "block" | "onTextChange" | "onDelete">) {
  const sfx = parseSfxPayload(block.textPayload);
  const [desc, setDesc]           = useState(sfx?.description ?? "");
  const [dur, setDur]             = useState(sfx?.durationSec ?? 3);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError]         = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef  = useRef<string | null>(null);

  useEffect(() => {
    const parsed = parseSfxPayload(block.textPayload);
    if (parsed) { setDesc(parsed.description); setDur(parsed.durationSec); }
  }, [block.textPayload]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [desc]);

  // Cleanup audio on unmount
  useEffect(() => () => {
    audioRef.current?.pause();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  const commit = (newDesc = desc, newDur = dur) => {
    onTextChange(block.id, buildSfxPayload(newDesc, newDur));
  };

  const handlePlay = async () => {
    // Stop if already playing
    if (isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
      return;
    }
    if (!desc.trim()) return;

    setAudioError(null);
    setIsLoadingAudio(true);
    try {
      const res  = await fetch("/api/preview-sfx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc, durationSec: dur }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SFX generation failed");

      const bytes  = Uint8Array.from(atob(data.audioData), (c) => c.charCodeAt(0));
      const blob   = new Blob([bytes], { type: data.mimeType ?? "audio/mpeg" });
      const url    = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay  = () => { setIsLoadingAudio(false); setIsPlayingAudio(true); };
      audio.onended = () => { setIsPlayingAudio(false); URL.revokeObjectURL(url); blobUrlRef.current = null; };
      audio.onerror = () => { setIsPlayingAudio(false); setIsLoadingAudio(false); setAudioError("Playback failed"); };
      await audio.play();
    } catch (err: unknown) {
      setAudioError(err instanceof Error ? err.message : "Failed");
      setIsLoadingAudio(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-2"
      style={{
        background: "rgba(245,158,11,0.05)",
        border: "1px solid rgba(245,158,11,0.22)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">🔊</span>
        <span className="text-[10px] font-bold uppercase tracking-widest flex-1" style={{ color: "rgba(245,158,11,0.7)" }}>
          SFX
        </span>

        {/* Duration control */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30">Duration</span>
          <input
            type="number"
            min={0.5}
            max={22}
            step={0.5}
            value={dur}
            onChange={(e) => {
              const v = Math.min(22, Math.max(0.5, parseFloat(e.target.value) || 0.5));
              setDur(v);
              commit(desc, v);
            }}
            className="w-12 text-xs text-center rounded-lg px-1 py-0.5 outline-none"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "#F59E0B",
            }}
          />
          <span className="text-[10px] text-white/30">s</span>
        </div>

        {/* Play/Stop preview */}
        <button
          onClick={handlePlay}
          disabled={isLoadingAudio || !desc.trim()}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-all ml-1"
          style={
            isPlayingAudio
              ? { background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.5)" }
              : { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }
          }
          title={isPlayingAudio ? "Stop preview" : "Preview this sound"}
        >
          {isLoadingAudio ? (
            <span className="w-2.5 h-2.5 border border-t-transparent rounded-full animate-spin" style={{ borderColor: "#F59E0B", borderTopColor: "transparent" }} />
          ) : isPlayingAudio ? (
            <span className="text-[8px]" style={{ color: "#F59E0B" }}>■</span>
          ) : (
            <span className="text-[9px] ml-px" style={{ color: "rgba(245,158,11,0.6)" }}>▶</span>
          )}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(block.id)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/25 hover:text-red-400 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
          title="Remove SFX"
        >
          ✕
        </button>
      </div>

      {/* Description textarea */}
      <textarea
        ref={textareaRef}
        value={desc}
        onChange={(e) => { setDesc(e.target.value); commit(e.target.value, dur); }}
        rows={1}
        placeholder="Describe the sound effect…"
        className="w-full bg-transparent text-sm leading-relaxed resize-none outline-none overflow-hidden"
        style={{ color: "rgba(255,255,255,0.65)", minHeight: "22px" }}
      />

      {audioError && (
        <p className="text-[10px]" style={{ color: "rgba(245,158,11,0.6)" }}>⚠ {audioError}</p>
      )}
    </div>
  );
}

// ─── Speech / narration card ──────────────────────────────────────────────────

function SpeechCard({
  block,
  voices,
  isPlaying,
  onTextChange,
  onVoiceChange,
  onPlayPreview,
  onDelete,
}: ScriptBlockCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isFocused, setIsFocused]   = useState(false);

  const assignedVoice = voices.find((v) => v.id === block.assignedVoiceId) ?? voices[0];
  const isNarrator    = block.characterName === "Narrator";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.textPayload]);

  return (
    <div
      className={`relative flex gap-3 p-3 rounded-2xl border transition-all duration-200 ${
        isFocused ? "bg-bg-elevated" : "bg-bg-card hover:border-white/10"
      }`}
      style={
        isFocused
          ? { borderColor: "rgba(79,195,247,0.4)", boxShadow: "0 0 0 1px rgba(79,195,247,0.1), 0 0 20px rgba(79,195,247,0.06)" }
          : { borderColor: "rgba(255,255,255,0.06)" }
      }
    >
      {/* Left focus bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-all duration-200"
        style={{ background: isFocused ? "linear-gradient(180deg,#4fc3f7,#8B5CF6)" : "transparent" }}
      />

      {/* Voice avatar — click to change voice */}
      <div className="relative flex-shrink-0 pt-0.5 group/voice">
        <button
          onClick={() => setShowPicker((p) => !p)}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-base border transition-all ${
            showPicker ? "border-teal bg-teal/15 shadow-teal-sm" : "border-bg-border bg-bg-elevated hover:border-teal/40"
          }`}
          aria-label={`Voice: ${assignedVoice?.name ?? ""}. Tap to change.`}
          title="Change voice"
        >
          {assignedVoice?.avatarEmoji ?? "🎙️"}
        </button>
        {/* "change voice" tooltip under avatar */}
        {!showPicker && (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[8px] font-semibold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/voice:opacity-100 transition-opacity pointer-events-none"
            style={{ color: "rgba(79,195,247,0.5)" }}
          >
            change
          </span>
        )}

        {showPicker && (
          <VoicePicker
            voices={voices}
            selectedVoiceId={block.assignedVoiceId}
            onSelect={(voiceId) => { onVoiceChange(block.id, voiceId); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Editable text area */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${isNarrator ? "text-purple-bright/60" : "text-teal/70"}`}>
            {block.characterName}
          </span>
          {assignedVoice && (
            <span className="text-white/15 text-[9px]">· {assignedVoice.name}</span>
          )}
          <span className="ml-auto text-[8px] text-white/20 italic">tap to edit</span>
        </div>
        <textarea
          ref={textareaRef}
          value={block.textPayload}
          onChange={(e) => onTextChange(block.id, e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={1}
          placeholder="Enter dialogue or narration…"
          className="w-full text-white/85 text-sm leading-relaxed resize-none outline-none placeholder-white/15 overflow-hidden rounded-lg px-2 py-1 transition-all"
          style={{
            minHeight: "22px",
            background: isFocused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
            border: isFocused ? "1px solid rgba(79,195,247,0.25)" : "1px solid rgba(255,255,255,0.05)",
          }}
        />
      </div>

      {/* Right-side controls */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        {/* Play preview */}
        <button
          onClick={() => onPlayPreview(block.id)}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            isPlaying
              ? "border border-teal/60 bg-teal/15 shadow-teal-sm"
              : "border border-bg-border bg-bg-elevated hover:border-teal/40 hover:bg-teal/8"
          }`}
          aria-label={isPlaying ? "Playing preview" : "Preview this block"}
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

        {/* Delete */}
        <button
          onClick={() => onDelete(block.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          title="Delete block"
        >
          <span className="text-[10px]">✕</span>
        </button>
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function ScriptBlockCard(props: ScriptBlockCardProps) {
  if (props.block.characterName === "SFX") {
    return <SfxCard block={props.block} onTextChange={props.onTextChange} onDelete={props.onDelete} />;
  }
  return <SpeechCard {...props} />;
}
