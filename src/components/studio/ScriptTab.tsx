"use client";

import { useState, useCallback, useRef } from "react";
import type { ScriptBlock, Voice } from "@/types";
import ScriptBlockCard from "./ScriptBlockCard";
import SpeechPlayerModal from "./SpeechPlayerModal";

interface ScriptTabProps {
  blocks: ScriptBlock[];
  voices: Voice[];
  onBlocksChange: (blocks: ScriptBlock[]) => void;
  onProduce: (blocks: ScriptBlock[]) => void;
  isProducing: boolean;
}

async function base64ToAudioUrl(base64: string, mimeType: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export default function ScriptTab({ blocks, voices, onBlocksChange, onProduce, isProducing }: ScriptTabProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;
  const activeVoice = activeBlock
    ? (voices.find((v) => v.id === activeBlock.assignedVoiceId) ?? voices[0])
    : null;

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (audioBlobUrl.current) {
      URL.revokeObjectURL(audioBlobUrl.current);
      audioBlobUrl.current = null;
    }
  }, []);

  const startSpeech = useCallback(async (block: ScriptBlock) => {
    stopAudio();
    setSpeechError(null);
    setIsLoading(true);
    setIsPlaying(false);
    setIsPaused(false);

    try {
      const res = await fetch("/api/synthesize-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: block.textPayload, characterName: block.characterName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speech generation failed");

      const url = await base64ToAudioUrl(data.audioData, data.mimeType ?? "audio/wav");
      audioBlobUrl.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay  = () => { setIsLoading(false); setIsPlaying(true);  setIsPaused(false); };
      audio.onpause = () => { setIsPlaying(false); setIsPaused(true);  };
      audio.onended = () => {
        setIsPlaying(false); setIsPaused(false); setActiveBlockId(null);
        URL.revokeObjectURL(url); audioBlobUrl.current = null;
      };
      audio.onerror = () => {
        setSpeechError("Playback failed"); setIsLoading(false); setIsPlaying(false);
      };

      await audio.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate audio";
      setSpeechError(msg);
      setIsLoading(false);
    }
  }, [stopAudio]);

  const handleOpenPlayer = useCallback((id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    setActiveBlockId(id);
    startSpeech(block);
  }, [blocks, startSpeech]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      if (activeBlock) startSpeech(activeBlock);
      return;
    }
    if (isPaused) {
      audio.play();
    } else if (isPlaying) {
      audio.pause();
    }
  }, [isPaused, isPlaying, activeBlock, startSpeech]);

  const handleStop = useCallback(() => {
    stopAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    setActiveBlockId(null);
    setSpeechError(null);
  }, [stopAudio]);

  const handleTextChange = useCallback(
    (id: string, text: string) =>
      onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, textPayload: text } : b))),
    [blocks, onBlocksChange],
  );

  const handleVoiceChange = useCallback(
    (id: string, voiceId: string) =>
      onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, assignedVoiceId: voiceId } : b))),
    [blocks, onBlocksChange],
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
    (sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0,
  );
  const estimatedSecs = Math.ceil(totalWords / 2.5);
  const estimatedMin = Math.floor(estimatedSecs / 60);
  const estimatedRemSec = estimatedSecs % 60;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-white/30 text-xs">
            {blocks.length} blocks · ~{estimatedMin}:{String(estimatedRemSec).padStart(2, "0")} min
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            <span className="text-teal text-[10px] font-semibold tracking-widest">READY</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {blocks.map((block) => (
            <ScriptBlockCard
              key={block.id}
              block={block}
              voices={voices}
              isPlaying={activeBlockId === block.id && isPlaying}
              onTextChange={handleTextChange}
              onVoiceChange={handleVoiceChange}
              onPlayPreview={handleOpenPlayer}
            />
          ))}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

        <button
          onClick={() => onProduce(blocks)}
          disabled={isProducing}
          className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
            !isProducing ? "btn-vivid" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
          }`}
        >
          {isProducing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse-slow">🎙️</span>Mixing audio tracks…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">🎙️ Produce Story</span>
          )}
        </button>
      </div>

      {activeBlock && activeVoice && (
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
