"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

export default function ScriptTab({ blocks, voices, onBlocksChange, onProduce, isProducing }: ScriptTabProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Pre-load voices so they're available when user taps play
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;
  const activeVoice = activeBlock ? (voices.find((v) => v.id === activeBlock.assignedVoiceId) ?? voices[0]) : null;

  const startSpeech = useCallback((block: ScriptBlock) => {
    setSpeechError(null);

    if (!('speechSynthesis' in window)) {
      setSpeechError("Speech not supported in this browser");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(block.textPayload);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1;

      // Explicitly pick a voice — Chrome on Windows silently fails without one
      const available = synth.getVoices();
      const pick = available.find((v) => v.lang.startsWith("en") && v.localService)
        ?? available.find((v) => v.lang.startsWith("en"))
        ?? available[0];
      if (pick) utterance.voice = pick;

      utterance.onstart = () => { setIsPlaying(true); setIsPaused(false); };
      utterance.onend = () => { setIsPlaying(false); setIsPaused(false); setActiveBlockId(null); };
      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error", e);
        setSpeechError(`Audio error: ${e.error}`);
        setIsPlaying(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);

      // Verify it actually started (Chrome silent-fail guard)
      setTimeout(() => {
        if (!synth.speaking && !synth.pending) {
          setSpeechError("Audio didn't start — check system volume or try again");
          setIsPlaying(false);
        }
      }, 400);
    };

    setTimeout(doSpeak, 150);
    setIsPlaying(true);
    setIsPaused(false);
  }, [voices]);

  const handleOpenPlayer = useCallback((id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    setActiveBlockId(id);
    startSpeech(block);
  }, [blocks, startSpeech]);

  const handlePlayPause = useCallback(() => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (activeBlock) {
      startSpeech(activeBlock);
    }
  }, [isPaused, isPlaying, activeBlock, startSpeech]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveBlockId(null);
  }, []);

  const handleTextChange = useCallback(
    (id: string, text: string) => onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, textPayload: text } : b))),
    [blocks, onBlocksChange]
  );

  const handleVoiceChange = useCallback(
    (id: string, voiceId: string) => onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, assignedVoiceId: voiceId } : b))),
    [blocks, onBlocksChange]
  );

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="text-5xl mb-3 opacity-40">📜</span>
        <p className="text-white/25 text-sm">Generate a story first to see the script</p>
      </div>
    );
  }

  const totalWords = blocks.reduce((sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
  const estimatedSecs = Math.ceil(totalWords / 2.5);
  const estimatedMin = Math.floor(estimatedSecs / 60);
  const estimatedRemSec = estimatedSecs % 60;

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Meta bar */}
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
            <span className="flex items-center justify-center gap-2"><span className="animate-pulse-slow">🎙️</span>Mixing audio tracks…</span>
          ) : (
            <span className="flex items-center justify-center gap-2">🎙️ Produce Story</span>
          )}
        </button>
      </div>

      {/* Floating speech player */}
      {activeBlock && activeVoice && (
        <SpeechPlayerModal
          block={activeBlock}
          voice={activeVoice}
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
