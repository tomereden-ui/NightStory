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
      // Stop any current speech
      window.speechSynthesis.cancel();

      if (playingBlockId === id) {
        setPlayingBlockId(null);
        return;
      }

      const block = blocks.find((b) => b.id === id);
      if (!block) return;

      const utterance = new SpeechSynthesisUtterance(block.textPayload);

      // Pick a voice based on assigned voice character
      const allVoices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.id === block.assignedVoiceId);
      if (voice) {
        // Match gender/style to browser voice
        const preferred = allVoices.find((bv) =>
          voice.gender === "female"
            ? bv.name.toLowerCase().includes("female") || bv.name.toLowerCase().includes("samantha") || bv.name.toLowerCase().includes("victoria") || bv.name.toLowerCase().includes("zira")
            : bv.name.toLowerCase().includes("male") || bv.name.toLowerCase().includes("david") || bv.name.toLowerCase().includes("mark")
        );
        if (preferred) utterance.voice = preferred;
        utterance.pitch = voice.style === "playful" ? 1.3 : voice.style === "calm" ? 0.9 : 1.0;
        utterance.rate = voice.style === "gentle" ? 0.85 : voice.style === "calm" ? 0.9 : 1.0;
      }

      setPlayingBlockId(id);
      utterance.onend = () => setPlayingBlockId((cur) => (cur === id ? null : cur));
      utterance.onerror = () => setPlayingBlockId(null);
      window.speechSynthesis.speak(utterance);
    },
    [playingBlockId, blocks, voices]
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
