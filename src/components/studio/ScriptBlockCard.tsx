"use client";

import { useRef, useEffect, useState } from "react";
import type { ScriptBlock, Voice } from "@/types";
import VoicePicker from "./VoicePicker";
import { useLanguage } from "@/context/LanguageContext";
import VoiceAvatar from "@/components/ui/VoiceAvatar";
import Icon from "@/components/ui/Icon";

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
  onReviseBlock?: (id: string, instruction: string) => void;
  isRevising?: boolean;
  characterAvatarUrl?: string;
}

// ─── Validated badge ──────────────────────────────────────────────────────────

function ValidatedBadge() {
  return (
    <span
      title="Verified safe for children by AI"
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "rgba(34,197,94,0.14)",
        border: "1px solid rgba(34,197,94,0.38)",
        color: "rgba(34,197,94,0.9)",
        fontSize: "var(--fs-micro)",
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "-0.5px",
      }}
    >
      ✓
    </span>
  );
}

// ─── SFX card ─────────────────────────────────────────────────────────────────

function SfxCard({ block, onTextChange, onDelete }: Pick<ScriptBlockCardProps, "block" | "onTextChange" | "onDelete">) {
  const { t } = useLanguage();
  const sfx = parseSfxPayload(block.textPayload);
  const [desc, setDesc]           = useState(sfx?.description ?? "");
  const [dur, setDur]             = useState(sfx?.durationSec ?? 3);
  const [editingDur, setEditingDur] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError]         = useState<string | null>(null);
  const [sfxWarning, setSfxWarning]         = useState<string | null>(null);
  const [isValidating, setIsValidating]     = useState(false);
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

  const validateSfx = async (value: string) => {
    if (value.trim().length < 4) return;
    setIsValidating(true);
    setSfxWarning(null);
    try {
      const res = await fetch("/api/validate-sfx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value.trim() }),
      });
      const data = await res.json();
      if (!data.valid && data.reason) setSfxWarning(data.reason);
    } catch {
      // non-fatal
    } finally {
      setIsValidating(false);
    }
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
      className="rounded-2xl p-3 flex gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(245,158,11,0.2)",
      }}
    >
      {/* Left col — amber icon circle */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
      >
        <span className="text-fs-heading">🔊</span>
      </div>

      {/* Center col */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Top row: SFX label + duration pill/stepper */}
        <div className="flex items-center gap-1.5">
          <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(245,158,11,0.7)" }}>
            SFX
          </span>
          {block.validated && <ValidatedBadge />}

          {editingDur ? (
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => { const v = Math.max(0.5, dur - 0.5); setDur(v); commit(desc, v); }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-fs-body"
                style={{ background: "rgba(245,158,11,0.1)", color: "rgba(245,158,11,0.7)" }}
              >−</button>
              <span className="text-fs-body min-w-[24px] text-center" style={{ color: "#F59E0B" }}>{dur}s</span>
              <button
                onClick={() => { const v = Math.min(22, dur + 0.5); setDur(v); commit(desc, v); }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-fs-body"
                style={{ background: "rgba(245,158,11,0.1)", color: "rgba(245,158,11,0.7)" }}
              >+</button>
              <button
                onClick={() => setEditingDur(false)}
                className="text-fs-body ml-1"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >✓</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingDur(true)}
              className="text-fs-body px-2 py-0.5 rounded-full ml-auto"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "rgba(245,158,11,0.7)" }}
            >
              {dur}s
            </button>
          )}
        </div>

        {/* Description textarea */}
        <textarea
          ref={textareaRef}
          value={desc}
          onChange={(e) => {
            setDesc(e.target.value);
            commit(e.target.value, dur);
            if (sfxWarning) setSfxWarning(null);
          }}
          onBlur={() => validateSfx(desc)}
          rows={1}
          placeholder={t("sfxPlaceholder")}
          className="w-full bg-transparent text-fs-body leading-relaxed resize-none outline-none text-white/75 overflow-hidden"
          style={{ minHeight: "22px" }}
        />

        {/* Validation states */}
        {isValidating && (
          <p className="text-fs-body flex items-center gap-1" style={{ color: "rgba(245,158,11,0.45)" }}>
            <span className="w-2 h-2 border border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor: "rgba(245,158,11,0.5)", borderTopColor: "transparent" }} />
            Checking…
          </p>
        )}

        {sfxWarning && !isValidating && (
          <div
            className="flex items-start gap-1.5 px-2.5 py-2 rounded-xl text-fs-body leading-snug"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "rgba(245,158,11,0.85)" }}
          >
            <span className="flex-shrink-0 mt-px">⚠</span>
            <span>This doesn&apos;t sound like a specific effect. {sfxWarning}</span>
          </div>
        )}

        {audioError && !sfxWarning && (
          <p className="text-fs-body" style={{ color: "rgba(245,158,11,0.6)" }}>⚠ {audioError}</p>
        )}
      </div>

      {/* Right col — play + delete */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        {/* Play/Stop preview */}
        <button
          onClick={handlePlay}
          disabled={isLoadingAudio || !desc.trim()}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
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
            <Icon name="stop" size={8} style={{ color: "#F59E0B" }} />
          ) : (
            <Icon name="play" size={9} style={{ color: "rgba(245,158,11,0.6)" }} />
          )}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(block.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          title="Remove SFX"
        >
          <Icon name="close" size={10} />
        </button>
      </div>
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
  onReviseBlock,
  isRevising,
  characterAvatarUrl,
}: ScriptBlockCardProps) {
  const { t } = useLanguage();
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const directRef     = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker]         = useState(false);
  const [isFocused, setIsFocused]           = useState(false);
  const [showDirectMenu, setShowDirectMenu] = useState(false);
  const [directNote, setDirectNote]         = useState("");

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
      className="flex flex-col p-3 rounded-2xl border transition-all duration-200"
      style={
        isFocused
          ? { background: "rgba(255,255,255,0.04)", borderColor: "rgba(79,195,247,0.3)", boxShadow: "0 0 0 1px rgba(79,195,247,0.1), 0 0 20px rgba(79,195,247,0.06)" }
          : { background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }
      }
    >
    <div className="flex gap-3">

      {/* Character / voice avatar — click to change voice */}
      <div className="relative flex-shrink-0 pt-0.5 group/voice">
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="relative flex items-center justify-center transition-all"
          aria-label={`Voice: ${assignedVoice?.name ?? ""}. Tap to change.`}
          title="Change voice"
        >
          {characterAvatarUrl ? (
            /* Character portrait as primary avatar */
            <div
              className="w-11 h-11 rounded-full overflow-hidden relative"
              style={{
                border: showPicker ? "2px solid #4fc3f7" : "1.5px solid rgba(255,255,255,0.12)",
                boxShadow: showPicker ? "0 0 10px rgba(79,195,247,0.3)" : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={characterAvatarUrl} alt={block.characterName} className="w-full h-full object-cover" />
              {/* Voice indicator — small overlay in corner */}
              {assignedVoice?.avatarUrl && (
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 rounded-full overflow-hidden"
                  style={{ border: "1.5px solid rgba(5,8,20,1)", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assignedVoice.avatarUrl} alt={assignedVoice.name} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ) : (
            /* Fallback: voice avatar */
            <div className={showPicker ? "ring-2 ring-teal shadow-teal-sm rounded-full" : ""}>
              <VoiceAvatar avatarUrl={assignedVoice?.avatarUrl} emoji={assignedVoice?.avatarEmoji ?? "🎙️"} size={36} borderColor="rgba(79,195,247,0.2)" />
            </div>
          )}
        </button>
        {/* "change voice" tooltip */}
        {!showPicker && (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-fs-body font-semibold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/voice:opacity-100 transition-opacity pointer-events-none"
            style={{ color: "rgba(79,195,247,0.5)" }}
          >
            {t("changeVoice")}
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
          <span className={`text-fs-body font-semibold uppercase tracking-widest ${isNarrator ? "text-purple-bright/60" : "text-teal/70"}`}>
            {block.characterName}
          </span>
          {block.validated && <ValidatedBadge />}
          {assignedVoice && (
            <span className="text-white/25 text-fs-body">· {assignedVoice.name}</span>
          )}
          <span className="ml-auto text-fs-body text-white/25 italic">{t("tapToEdit")}</span>
        </div>
        <textarea
          ref={textareaRef}
          value={block.textPayload}
          onChange={(e) => onTextChange(block.id, e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={1}
          placeholder="Enter dialogue or narration…"
          className="w-full text-white/85 text-fs-body leading-relaxed resize-none outline-none placeholder-white/15 overflow-hidden rounded-lg px-2 py-1 transition-all"
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
            <Icon name="play" size={10} className="text-white/30 ml-px" />
          )}
        </button>

        {/* Director menu toggle */}
        {onReviseBlock && (
          <button
            onClick={() => { setShowDirectMenu((s) => !s); setTimeout(() => directRef.current?.focus(), 60); }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
            style={showDirectMenu
              ? { background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.5)", color: "#A78BFA" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)" }
            }
            title="Direct this line"
          >
            <span className="text-fs-body leading-none">⋯</span>
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDelete(block.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          title="Delete block"
        >
          <Icon name="close" size={10} />
        </button>
      </div>

    </div>
      {/* Inline direction panel — full-width row below the card content */}
      {showDirectMenu && onReviseBlock && (
        <div
          className="col-span-full mt-2 rounded-xl p-2.5 flex flex-col gap-2"
          style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {["✨ Make it more magical", "😴 Make it sleepier", "😂 Make it funnier", "🔄 Rewrite this line"].map((chip) => (
              <button
                key={chip}
                disabled={isRevising}
                onClick={() => { onReviseBlock(block.id, chip); setShowDirectMenu(false); }}
                className="text-fs-body px-2.5 py-1 rounded-full transition-all active:scale-95"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#C4B5FD" }}
              >
                {chip}
              </button>
            ))}
          </div>
          {/* Custom input */}
          <div className="flex gap-1.5 items-center">
            <input
              ref={directRef}
              type="text"
              value={directNote}
              onChange={(e) => setDirectNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && directNote.trim()) { onReviseBlock(block.id, directNote.trim()); setShowDirectMenu(false); setDirectNote(""); }
                if (e.key === "Escape") setShowDirectMenu(false);
              }}
              placeholder="Type direction for this line…"
              className="flex-1 rounded-lg px-2.5 py-1.5 text-fs-body outline-none text-white/80"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.25)" }}
            />
            <button
              disabled={!directNote.trim() || isRevising}
              onClick={() => { if (directNote.trim()) { onReviseBlock(block.id, directNote.trim()); setShowDirectMenu(false); setDirectNote(""); } }}
              className="px-2.5 py-1.5 rounded-lg text-fs-body font-semibold transition-all active:scale-95"
              style={directNote.trim() && !isRevising
                ? { background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#A78BFA" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }
              }
            >
              <Icon name="submit" size={12} />
            </button>
          </div>
        </div>
      )}
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

