"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ScriptBlock, Voice } from "@/types";
import ScriptBlockCard, { buildSfxPayload } from "./ScriptBlockCard";
import SpeechPlayerModal from "./SpeechPlayerModal";
import { useLanguage } from "@/context/LanguageContext";
import VoiceAvatar from "@/components/ui/VoiceAvatar";

interface ScriptTabProps {
  blocks: ScriptBlock[];
  voices: Voice[];
  onBlocksChange: (blocks: ScriptBlock[]) => void;
  onProduce: (blocks: ScriptBlock[], durationMinutes: number) => void;
  isProducing: boolean;
  summary?: string;
  coverUrl?: string;
  isFetchingCover?: boolean;
  onRegenerateCover?: () => void;
  durationMinutes?: number;
  onDurationChange?: (v: number) => void;
  hideDirectorsNote?: boolean;
}

function makeId() {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function base64ToAudioUrl(base64: string, mimeType: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

// ─── Inline SFX insert form ───────────────────────────────────────────────────

function SfxInsertForm({
  onInsert,
  onCancel,
}: {
  onInsert: (description: string, durationSec: number) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [desc, setDesc] = useState("");
  const dur = 3;
  const inputRef = useRef<HTMLInputElement>(null);

  useState(() => { setTimeout(() => inputRef.current?.focus(), 50); });

  const handleInsert = () => {
    if (!desc.trim()) return;
    onInsert(desc.trim(), dur);
  };

  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-3 my-1"
      style={{ background: "rgba(245,158,11,0.07)", border: "1.5px dashed rgba(245,158,11,0.35)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">🔊</span>
        <span className="text-[10px] font-bold uppercase tracking-widest flex-1" style={{ color: "rgba(245,158,11,0.7)" }}>
          {t("newSoundEffect")}
        </span>
        <button onClick={onCancel} className="text-white/30 text-xs hover:text-white/60 transition-colors">
          {t("cancel")}
        </button>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); if (e.key === "Escape") onCancel(); }}
        placeholder={t("sfxPlaceholder")}
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.3)", color: "rgba(255,255,255,0.8)" }}
      />

      <button
        onClick={handleInsert}
        disabled={!desc.trim()}
        className="w-full px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
        style={desc.trim()
          ? { background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.5)", color: "#F59E0B" }
          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.2)" }
        }
      >
        {t("insertSfx")}
      </button>
    </div>
  );
}

// ─── Add-block separator (SFX + Text) ────────────────────────────────────────

function BlockSeparator({ onAddSfx, onAddText }: { onAddSfx: () => void; onAddText: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="w-full flex items-center gap-2 py-1 px-2">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      {expanded ? (
        <>
          <button
            onClick={() => { setExpanded(false); onAddSfx(); }}
            className="text-xs font-semibold px-3 py-1 rounded-full transition-all"
            style={{ color: "rgba(245,158,11,0.7)", border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.06)" }}
          >
            🔊 Sound
          </button>
          <button
            onClick={() => { setExpanded(false); onAddText(); }}
            className="text-xs font-semibold px-3 py-1 rounded-full transition-all"
            style={{ color: "rgba(79,195,247,0.7)", border: "1px solid rgba(79,195,247,0.2)", background: "rgba(79,195,247,0.05)" }}
          >
            💬 Dialogue
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-white/20 hover:text-white/40"
          >✕</button>
        </>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-light transition-all"
          style={{ color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
        >
          +
        </button>
      )}
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
    </div>
  );
}

// ─── Text insert modal ───────────────────────────────────────────────────────

function TextInsertModal({
  voices,
  existingCharacters,
  onInsert,
  onCancel,
}: {
  voices: Voice[];
  existingCharacters: string[];
  onInsert: (characterName: string, voiceId: string, text: string) => void;
  onCancel: () => void;
}) {
  const [charName, setCharName]         = useState("Narrator");
  const [voiceId, setVoiceId]           = useState(voices[0]?.id ?? "");
  const [text, setText]                 = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 80); }, []);

  const suggestions = Array.from(new Set(["Narrator", ...existingCharacters])).slice(0, 5);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setError(null);
    setIsValidating(true);
    try {
      const res = await fetch("/api/validate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), characterName: charName }),
      });
      const data = await res.json();
      if (!data.valid) {
        setError(data.reason || "This text doesn't look like valid story content. Please refine it.");
        setIsValidating(false);
        return;
      }
    } catch {
      // fail open — insert anyway
    }
    setIsValidating(false);
    onInsert(charName.trim() || "Narrator", voiceId, text.trim());
  };

  const selectedVoice = voices.find((v) => v.id === voiceId) ?? voices[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(5,8,20,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md mx-auto rounded-t-3xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        style={{ background: "#0d1120", border: "1px solid rgba(79,195,247,0.15)", borderBottom: "none" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Add Dialogue</h3>
          <button onClick={onCancel} className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 transition-colors text-xs"
            style={{ background: "rgba(255,255,255,0.06)" }}>✕</button>
        </div>

        {/* Character name */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Character</label>
          <input
            type="text"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            placeholder="Narrator"
            className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(79,195,247,0.2)" }}
          />
          {/* Character suggestions */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setCharName(s)}
                className="text-[10px] px-2.5 py-0.5 rounded-full transition-colors"
                style={charName === s
                  ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Voice picker */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Voice</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {voices.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoiceId(v.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl transition-all"
                style={v.id === voiceId
                  ? { background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.4)" }
                  : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                <VoiceAvatar avatarUrl={v.avatarUrl} emoji={v.avatarEmoji} size={32} borderColor="rgba(79,195,247,0.2)" />
                <span className="text-[9px] font-semibold" style={{ color: v.id === voiceId ? "#4fc3f7" : "rgba(255,255,255,0.4)" }}>
                  {v.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
          {selectedVoice && (
            <p className="text-[10px] text-white/20 mt-1">{selectedVoice.name} · {selectedVoice.style}</p>
          )}
        </div>

        {/* Text input */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Text</label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
            rows={4}
            placeholder="Type the dialogue or narration…"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white/85 leading-relaxed outline-none resize-none placeholder-white/20"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(79,195,247,0.2)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.45)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.2)")}
          />
        </div>

        {/* Validation error */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs leading-snug"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "rgba(239,68,68,0.85)" }}>
            <span className="flex-shrink-0 mt-px">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Insert button */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isValidating}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={text.trim() && !isValidating
            ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F" }
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }
          }
        >
          {isValidating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#4fc3f7" }} />
              Checking…
            </>
          ) : (
            "Insert Block"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── ScriptTab ────────────────────────────────────────────────────────────────

export default function ScriptTab({ blocks, voices, onBlocksChange, onProduce, isProducing, summary, coverUrl, isFetchingCover = false, onRegenerateCover, durationMinutes = 3, onDurationChange, hideDirectorsNote = false }: ScriptTabProps) {
  const { t, language } = useLanguage();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isPaused, setIsPaused]           = useState(false);
  const [speechError, setSpeechError]     = useState<string | null>(null);
  const [insertingAt, setInsertingAt]         = useState<number | null>(null);
  const [insertingTextAt, setInsertingTextAt] = useState<number | null>(null);
  // Regenerate / validate state
  const [isDirty, setIsDirty]             = useState(false);
  const [isValidating, setIsValidating]   = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[] | null>(null);

  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;
  const activeVoice = activeBlock
    ? (voices.find((v) => v.id === activeBlock.assignedVoiceId) ?? voices[0])
    : null;

  // ─── Audio ─────────────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
    if (audioBlobUrl.current) { URL.revokeObjectURL(audioBlobUrl.current); audioBlobUrl.current = null; }
  }, []);

  const startSpeech = useCallback(async (block: ScriptBlock) => {
    stopAudio();
    setSpeechError(null); setIsLoading(true); setIsPlaying(false); setIsPaused(false);
    try {
      const res  = await fetch("/api/synthesize-speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: block.textPayload, characterName: block.characterName, assignedVoiceId: block.assignedVoiceId, language }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speech generation failed");
      const url = await base64ToAudioUrl(data.audioData, data.mimeType ?? "audio/wav");
      audioBlobUrl.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay  = () => { setIsLoading(false); setIsPlaying(true); setIsPaused(false); };
      audio.onpause = () => { setIsPlaying(false); setIsPaused(true); };
      audio.onended = () => { setIsPlaying(false); setIsPaused(false); setActiveBlockId(null); URL.revokeObjectURL(url); audioBlobUrl.current = null; };
      audio.onerror = () => { setSpeechError("Playback failed"); setIsLoading(false); setIsPlaying(false); };
      await audio.play();
    } catch (err: unknown) {
      setSpeechError(err instanceof Error ? err.message : "Failed to generate audio");
      setIsLoading(false);
    }
  }, [stopAudio]);

  const handleOpenPlayer = useCallback((id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block || block.characterName === "SFX") return;
    setActiveBlockId(id); startSpeech(block);
  }, [blocks, startSpeech]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) { if (activeBlock) startSpeech(activeBlock); return; }
    if (isPaused) audio.play();
    else if (isPlaying) audio.pause();
  }, [isPaused, isPlaying, activeBlock, startSpeech]);

  const handleStop = useCallback(() => {
    stopAudio(); setIsPlaying(false); setIsPaused(false); setIsLoading(false); setActiveBlockId(null); setSpeechError(null);
  }, [stopAudio]);

  // ─── Block mutations ────────────────────────────────────────────────────────

  const markDirty = useCallback(() => { setIsDirty(true); setValidationIssues(null); }, []);

  const handleTextChange = useCallback(
    (id: string, text: string) => { onBlocksChange(blocks.map((b) => b.id === id ? { ...b, textPayload: text } : b)); markDirty(); },
    [blocks, onBlocksChange, markDirty],
  );

  const handleVoiceChange = useCallback(
    (id: string, voiceId: string) => { onBlocksChange(blocks.map((b) => b.id === id ? { ...b, assignedVoiceId: voiceId } : b)); markDirty(); },
    [blocks, onBlocksChange, markDirty],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (activeBlockId === id) handleStop();
      onBlocksChange(blocks.filter((b) => b.id !== id));
      markDirty();
    },
    [blocks, onBlocksChange, activeBlockId, handleStop, markDirty],
  );

  const handleInsertText = useCallback(
    (insertIdx: number, characterName: string, voiceId: string, text: string) => {
      const newBlock: ScriptBlock = {
        id: makeId(),
        blockOrder: insertIdx + 1,
        characterName,
        assignedVoiceId: voiceId,
        textPayload: text,
      };
      const updated = [...blocks];
      updated.splice(insertIdx, 0, newBlock);
      onBlocksChange(updated.map((b, i) => ({ ...b, blockOrder: i + 1 })));
      setInsertingTextAt(null);
      markDirty();
    },
    [blocks, onBlocksChange, markDirty],
  );

  const handleInsertSfx = useCallback(
    (insertIdx: number, description: string, durationSec: number) => {
      const newBlock: ScriptBlock = {
        id: makeId(),
        blockOrder: insertIdx + 1,
        characterName: "SFX",
        assignedVoiceId: "",
        textPayload: buildSfxPayload(description, durationSec),
      };
      const updated = [...blocks];
      updated.splice(insertIdx, 0, newBlock);
      onBlocksChange(updated.map((b, i) => ({ ...b, blockOrder: i + 1 })));
      setInsertingAt(null);
      markDirty();
    },
    [blocks, onBlocksChange, markDirty],
  );

  // ─── Director revise ────────────────────────────────────────────────────────

  const [directorNote, setDirectorNote]   = useState("");
  const [isRevising, setIsRevising]       = useState(false);
  const [reviseError, setReviseError]     = useState<string | null>(null);

  const handleRevise = useCallback(async (instruction: string) => {
    if (!instruction.trim() || isRevising) return;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks, instruction: instruction.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      onBlocksChange(data.blocks);
      setDirectorNote("");
      markDirty();
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  }, [blocks, isRevising, onBlocksChange, markDirty]);

  const handleReviseBlock = useCallback(async (id: string, instruction: string) => {
    if (!instruction.trim() || isRevising) return;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks, instruction: instruction.trim(), targetBlockId: id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      onBlocksChange(data.blocks);
      markDirty();
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  }, [blocks, isRevising, onBlocksChange, markDirty]);

  // ─── Validate / regenerate ──────────────────────────────────────────────────

  const handleRegenerate = useCallback(async () => {
    setIsValidating(true);
    setValidationIssues(null);
    try {
      const res  = await fetch("/api/validate-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");

      if (data.ok) {
        // Apply the reviewed/corrected blocks from Gemini
        const corrected = (data.blocks as Array<{ characterName: string; textPayload: string }>).map(
          (b, i) => ({
            ...(blocks[i] ?? { id: makeId(), assignedVoiceId: "" }),
            characterName: b.characterName,
            textPayload: b.textPayload,
            blockOrder: i + 1,
          }),
        );
        onBlocksChange(corrected);
        setIsDirty(false);
      } else {
        setValidationIssues(data.issues ?? ["Unknown issue"]);
      }
    } catch (err: unknown) {
      setValidationIssues([err instanceof Error ? err.message : "Validation request failed"]);
    } finally {
      setIsValidating(false);
    }
  }, [blocks, onBlocksChange]);

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="text-5xl mb-3 opacity-40">📜</span>
        <p className="text-white/25 text-sm">{t("scriptEmpty")}</p>
      </div>
    );
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const speechBlocks = blocks.filter((b) => b.characterName !== "SFX");
  const sfxBlocks    = blocks.filter((b) => b.characterName === "SFX");
  const totalWords   = speechBlocks.reduce((s, b) => s + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
  const estSecs      = Math.ceil(totalWords / 2.5);
  const estMin       = Math.floor(estSecs / 60);
  const estSec       = estSecs % 60;

  // ─── Derived ────────────────────────────────────────────────────────────────

  const existingCharacters = Array.from(
    new Set(blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName))
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-0">
        {/* Story header — cover + summary */}
        {(summary || isFetchingCover) && (
          <div className="mb-5 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(79,195,247,0.12)",
              boxShadow: "0 4px 20px rgba(79,195,247,0.06)",
            }}>
            {/* Cover image */}
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Story cover" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(ellipse at 35% 45%, rgba(26,58,110,0.9) 0%, rgba(45,27,78,0.95) 60%, rgba(10,12,20,1) 100%)",
                    minHeight: 180,
                  }}
                >
                  <span className="text-5xl animate-pulse opacity-30">🌙</span>
                </div>
              )}
              {/* Dark gradient at bottom for text overlap */}
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(10,12,20,0.95), transparent)" }}
              />
              {/* Regenerate cover button */}
              {onRegenerateCover && !isFetchingCover && (
                <button
                  onClick={onRegenerateCover}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                  style={{
                    background: "rgba(10,12,20,0.72)",
                    border: "1px solid rgba(79,195,247,0.3)",
                    color: "rgba(79,195,247,0.8)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  ↺ Cover
                </button>
              )}
              {isFetchingCover && (
                <div
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    background: "rgba(10,12,20,0.72)",
                    border: "1px solid rgba(79,195,247,0.2)",
                    color: "rgba(79,195,247,0.45)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span className="animate-pulse">✦</span> Generating…
                </div>
              )}
            </div>
            {/* Summary text */}
            {summary && (
              <div className="px-4 pt-3 pb-4" style={{ background: "rgba(10,12,20,0.97)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(79,195,247,0.45)" }}>Story</p>
                <p className="text-sm leading-relaxed italic" style={{ color: "rgba(255,255,255,0.82)" }}>{summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/30 text-xs">
            {speechBlocks.length} lines · {sfxBlocks.length} sfx · ~{estMin}:{String(estSec).padStart(2, "0")} min
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            <span className="text-teal text-[10px] font-semibold tracking-widest">{t("ready")}</span>
          </div>
        </div>

        {/* Block list with separators */}
        {blocks.map((block, idx) => (
          <div key={block.id}>
            {/* Insert form or separator — BEFORE this block */}
            {insertingAt === idx ? (
              <SfxInsertForm
                onInsert={(desc, dur) => handleInsertSfx(idx, desc, dur)}
                onCancel={() => setInsertingAt(null)}
              />
            ) : (
              <BlockSeparator
                onAddSfx={() => setInsertingAt(idx)}
                onAddText={() => setInsertingTextAt(idx)}
              />
            )}

            {/* The block card */}
            <div className="mb-0.5">
              <ScriptBlockCard
                block={block}
                voices={voices}
                isPlaying={activeBlockId === block.id && isPlaying}
                onTextChange={handleTextChange}
                onVoiceChange={handleVoiceChange}
                onPlayPreview={handleOpenPlayer}
                onDelete={handleDelete}
                onReviseBlock={handleReviseBlock}
                isRevising={isRevising}
              />
            </div>
          </div>
        ))}

        {/* After last block */}
        {insertingAt === blocks.length ? (
          <SfxInsertForm
            onInsert={(desc, dur) => handleInsertSfx(blocks.length, desc, dur)}
            onCancel={() => setInsertingAt(null)}
          />
        ) : (
          <BlockSeparator
            onAddSfx={() => setInsertingAt(blocks.length)}
            onAddText={() => setInsertingTextAt(blocks.length)}
          />
        )}

        <div className="h-px my-3" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Regenerate / validation panel */}
        {isDirty && (
          <div className="mb-3 flex flex-col gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isValidating}
              className="w-full py-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              style={
                isValidating
                  ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }
                  : { background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.35)", color: "#A78BFA" }
              }
            >
              {isValidating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#A78BFA" }} />
                  {t("reviewing")}
                </>
              ) : (
                <>✦ {t("regenerate")}</>
              )}
            </button>

            {validationIssues && (
              <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(239,68,68,0.7)" }}>
                  ⚠ {t("scriptIssues")}
                </p>
                <ul className="flex flex-col gap-1">
                  {validationIssues.map((issue, i) => (
                    <li key={i} className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Duration picker */}
        {!isProducing && (
          <div className="mb-3 rounded-2xl px-4 py-3 flex flex-col gap-2"
            style={{ background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.12)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>
                Story length
              </span>
              <span className="text-sm font-bold" style={{ color: "#4fc3f7" }}>
                {durationMinutes} min
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={durationMinutes}
              onChange={(e) => onDurationChange?.(Number(e.target.value))}
              className="w-full accent-teal h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: "#4fc3f7" }}
            />
            <div className="flex justify-between text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              <span>1 min</span>
              <span>5 min</span>
              <span>10 min</span>
            </div>
          </div>
        )}

        {/* Director's Note Bar — hidden when Studio page shows its own top-level version */}
        {!hideDirectorsNote && <div
          className="mb-3 rounded-2xl p-3 flex flex-col gap-2.5"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🎬</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(139,92,246,0.7)" }}>
              Director&apos;s Note
            </span>
            {isRevising && (
              <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: "rgba(139,92,246,0.6)" }}>
                <span className="w-2.5 h-2.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(139,92,246,0.3)", borderTopColor: "#A78BFA" }} />
                Revising…
              </span>
            )}
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "😴 More sleepy", instruction: "Make the whole story more sleepy and calming, perfect for bedtime" },
              { label: "✨ More magical", instruction: "Add more magic and wonder to the story — make it feel enchanted and dreamy" },
              { label: "😂 Funnier", instruction: "Make the story funnier and more playful with light humor for children" },
              { label: "✂️ Shorter", instruction: "Shorten the story — condense each block to be more concise while keeping the key moments" },
            ].map(({ label, instruction }) => (
              <button
                key={label}
                disabled={isRevising}
                onClick={() => handleRevise(instruction)}
                className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
                style={{
                  background: isRevising ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.25)",
                  color: isRevising ? "rgba(255,255,255,0.2)" : "#C4B5FD",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Free-text note input */}
          <div className="flex gap-2 items-end">
            <textarea
              value={directorNote}
              onChange={(e) => setDirectorNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && directorNote.trim()) {
                  e.preventDefault();
                  handleRevise(directorNote);
                }
              }}
              rows={2}
              placeholder="Tell the story what to change… (e.g. make the ending happier, add more tension in the middle)"
              disabled={isRevising}
              className="flex-1 rounded-xl px-3 py-2 text-xs leading-relaxed outline-none resize-none text-white/80 placeholder-white/20 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.45)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)")}
            />
            <button
              disabled={!directorNote.trim() || isRevising}
              onClick={() => handleRevise(directorNote)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={directorNote.trim() && !isRevising
                ? { background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.45)", color: "#A78BFA" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }
              }
            >
              ↵
            </button>
          </div>

          {reviseError && (
            <p className="text-[10px]" style={{ color: "rgba(239,68,68,0.7)" }}>⚠ {reviseError}</p>
          )}
        </div>}

        {/* Produce button */}
        <button
          onClick={() => onProduce(blocks, durationMinutes)}
          disabled={isProducing}
          className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
            !isProducing ? "btn-vivid" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
          }`}
        >
          {isProducing ? (
            <span className="flex items-center justify-center gap-2"><span className="animate-pulse-slow">🎙️</span>{t("mixingAudio")}</span>
          ) : (
            <span className="flex items-center justify-center gap-2">🎙️ {t("produceStory")}</span>
          )}
        </button>
      </div>

      {/* TTS preview modal */}
      {activeBlock && activeVoice && activeBlock.characterName !== "SFX" && (
        <SpeechPlayerModal
          block={activeBlock}
          voice={activeVoice}
          isLoading={isLoading}
          isPlaying={isPlaying}
          isPaused={isPaused}
          speechError={speechError}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
        />
      )}

      {/* Text insert modal */}
      {insertingTextAt !== null && (
        <TextInsertModal
          voices={voices}
          existingCharacters={existingCharacters}
          onInsert={(charName, vid, text) => handleInsertText(insertingTextAt, charName, vid, text)}
          onCancel={() => setInsertingTextAt(null)}
        />
      )}
    </>
  );
}
