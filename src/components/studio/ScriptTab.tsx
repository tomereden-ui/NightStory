"use client";

import { useState, useCallback } from "react";
import type { ScriptBlock, Voice } from "@/types";
import ScriptBlockCard from "./ScriptBlockCard";

interface ScriptTabProps {
  blocks: ScriptBlock[];
  voices: Voice[];
  onBlocksChange: (blocks: ScriptBlock[]) => void;
  onProduce: (blocks: ScriptBlock[]) => void;
  isProducing: boolean;
}

export default function ScriptTab({
  blocks,
  voices,
  onBlocksChange,
  onProduce,
  isProducing,
}: ScriptTabProps) {
  // Only one block plays at a time
  const [playingBlockId, setPlayingBlockId] = useState<string | null>(null);

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, textPayload: text } : b)));
    },
    [blocks, onBlocksChange]
  );

  const handleVoiceChange = useCallback(
    (id: string, voiceId: string) => {
      onBlocksChange(
        blocks.map((b) => (b.id === id ? { ...b, assignedVoiceId: voiceId } : b))
      );
    },
    [blocks, onBlocksChange]
  );

  const handlePlayPreview = useCallback(
    (id: string) => {
      if (playingBlockId === id) {
        setPlayingBlockId(null);
        return;
      }
      setPlayingBlockId(id);
      // Simulate 5-second TTS preview; real impl would call speech API here
      setTimeout(() => setPlayingBlockId((cur) => (cur === id ? null : cur)), 5000);
    },
    [playingBlockId]
  );

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="text-5xl mb-3 opacity-40">📜</span>
        <p className="text-white/25 text-sm">Generate a story first to see the script</p>
      </div>
    );
  }

  const totalWords = blocks.reduce(
    (sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length,
    0
  );
  const estimatedSecs = Math.ceil(totalWords / 2.5);
  const estimatedMin = Math.floor(estimatedSecs / 60);
  const estimatedRemSec = estimatedSecs % 60;

  return (
    <div className="flex flex-col gap-3">
      {/* Script meta bar */}
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-white/30 text-xs">
          {blocks.length} blocks · ~{estimatedMin}:{String(estimatedRemSec).padStart(2, "0")} min · tap{" "}
          <span className="text-teal/60">avatar</span> to reassign voice
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="text-teal text-[10px] font-semibold tracking-widest">READY</span>
        </div>
      </div>

      {/* Block list */}
      <div className="flex flex-col gap-2.5">
        {blocks.map((block) => (
          <ScriptBlockCard
            key={block.id}
            block={block}
            voices={voices}
            isPlaying={playingBlockId === block.id}
            onTextChange={handleTextChange}
            onVoiceChange={handleVoiceChange}
            onPlayPreview={handlePlayPreview}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

      {/* Produce button — submits compiled ScriptBlock[] to backend */}
      <button
        onClick={() => onProduce(blocks)}
        disabled={isProducing}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
          !isProducing
            ? "btn-vivid"
            : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
      >
        {isProducing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse-slow">🎙️</span>
            Mixing audio tracks…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            🎙️ Produce Story
          </span>
        )}
      </button>
    </div>
  );
}
