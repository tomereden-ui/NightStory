"use client";

import { useState, useCallback, useRef } from "react";
import type { ScriptBlock, Voice } from "@/types";
import ScriptBlockCard, { buildSfxPayload } from "./ScriptBlockCard";
import SpeechPlayerModal from "./SpeechPlayerModal";

interface ScriptTabProps {
  blocks: ScriptBlock[];
  voices: Voice[];
  onBlocksChange: (blocks: ScriptBlock[]) => void;
  onProduce: (blocks: ScriptBlock[]) => void;
  isProducing: boolean;
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
  const [desc, setDesc] = useState("");
  const [dur, setDur]   = useState(3);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the form mounts
  useState(() => { setTimeout(() => inputRef.current?.focus(), 50); });

  const handleInsert = () => {
    if (!desc.trim()) return;
    onInsert(desc.trim(), dur);
  };

  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-3 my-1"
      style={{
        background: "rgba(245,158,11,0.07)",
        border: "1.5px dashed rgba(245,158,11,0.35)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">🔊</span>
        <span className="text-[10px] font-bold uppercase tracking-widest flex-1" style={{ color: "rgba(245,158,11,0.7)" }}>
          New Sound Effect
        </span>
        <button onClick={onCancel} className="text-white/30 text-xs hover:text-white/60 transition-colors">
          Cancel
        </button>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); if (e.key === "Escape") onCancel(); }}
        placeholder="Describe the sound (e.g. gentle rain on a window, soft and steady)"
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(245,158,11,0.3)",
          color: "rgba(255,255,255,0.8)",
        }}
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[10px] text-white/30 whitespace-nowrap">Duration</span>
          <input
            type="number"
            min={0.5}
            max={22}
            step={0.5}
            value={dur}
            onChange={(e) => setDur(Math.min(22, Math.max(0.5, parseFloat(e.target.value) || 0.5)))}
            className="w-14 text-xs text-center rounded-lg px-2 py-1 outline-none"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "#F59E0B",
            }}
          />
          <span className="text-[10px] text-white/30">sec</span>
        </div>

        <button
          onClick={handleInsert}
          disabled={!desc.trim()}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={desc.trim()
            ? { background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.5)", color: "#F59E0B" }
            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.2)" }
          }
        >
          + Insert SFX
        </button>
      </div>
    </div>
  );
}

// ─── Add-SFX separator button ─────────────────────────────────────────────────

function SfxSeparator({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="w-full flex items-center gap-2 py-1 px-2 group transition-all"
      style={{ outline: "none" }}
      aria-label="Add sound effect here"
    >
      <div className="flex-1 h-px transition-all" style={{ background: "rgba(245,158,11,0.12)" }} />
      <span
        className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full transition-all group-hover:scale-105"
        style={{
          color: "rgba(245,158,11,0.45)",
          border: "1px dashed rgba(245,158,11,0.25)",
          background: "rgba(245,158,11,0.04)",
        }}
      >
        + add sfx
      </span>
      <div className="flex-1 h-px transition-all" style={{ background: "rgba(245,158,11,0.12)" }} />
    </button>
  );
}

// ─── ScriptTab ────────────────────────────────────────────────────────────────

export default function ScriptTab({ blocks, voices, onBlocksChange, onProduce, isProducing }: ScriptTabProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isPaused, setIsPaused]           = useState(false);
  const [speechError, setSpeechError]     = useState<string | null>(null);
  // insertingAt: index to insert BEFORE (0 = before first block, blocks.length = after last)
  const [insertingAt, setInsertingAt]     = useState<number | null>(null);

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
      const res  = await fetch("/api/synthesize-speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: block.textPayload, characterName: block.characterName }) });
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

  const handleTextChange = useCallback(
    (id: string, text: string) => onBlocksChange(blocks.map((b) => b.id === id ? { ...b, textPayload: text } : b)),
    [blocks, onBlocksChange],
  );

  const handleVoiceChange = useCallback(
    (id: string, voiceId: string) => onBlocksChange(blocks.map((b) => b.id === id ? { ...b, assignedVoiceId: voiceId } : b)),
    [blocks, onBlocksChange],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (activeBlockId === id) handleStop();
      onBlocksChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onBlocksChange, activeBlockId, handleStop],
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
      // Re-number blockOrder
      onBlocksChange(updated.map((b, i) => ({ ...b, blockOrder: i + 1 })));
      setInsertingAt(null);
    },
    [blocks, onBlocksChange],
  );

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="text-5xl mb-3 opacity-40">📜</span>
        <p className="text-white/25 text-sm">Generate a story first to see the script</p>
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-0">
        {/* Stats row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/30 text-xs">
            {speechBlocks.length} lines · {sfxBlocks.length} sfx · ~{estMin}:{String(estSec).padStart(2, "0")} min
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            <span className="text-teal text-[10px] font-semibold tracking-widest">READY</span>
          </div>
        </div>

        {/* Block list with separators */}
        {blocks.map((block, idx) => (
          <div key={block.id}>
            {/* SFX insert form or separator — BEFORE this block */}
            {insertingAt === idx ? (
              <SfxInsertForm
                onInsert={(desc, dur) => handleInsertSfx(idx, desc, dur)}
                onCancel={() => setInsertingAt(null)}
              />
            ) : (
              <SfxSeparator onAdd={() => { setInsertingAt(idx); }} />
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
          <SfxSeparator onAdd={() => setInsertingAt(blocks.length)} />
        )}

        <div className="h-px my-3" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Produce button */}
        <button
          onClick={() => onProduce(blocks)}
          disabled={isProducing}
          className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
            !isProducing ? "btn-vivid" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
          }`}
        >
          {isProducing ? (
            <span className="flex items-center justify-center gap-2"><span className="animate-pulse-slow">🎙️</span>Mixing audio tracks…</span>
          ) : (
            <span className="flex items-center justify-center gap-2">🎙️ Produce Story</span>
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
    </>
  );
}
