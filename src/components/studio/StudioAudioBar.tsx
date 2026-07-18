"use client";

import { useState, useRef } from "react";
import Icon from "@/components/ui/Icon";
import { useListeningProgress } from "@/hooks/useListeningProgress";

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Sticky bottom player for a just-produced story, matching the same player
// bar style used on the story (listener) page -- shown in place of Studio's
// old separate "Drama Ready" screen, so producing a story no longer navigates
// away from whatever you were doing; the finished audio just appears here.
//
// Listening here used to be entirely untracked -- this <audio> element made
// zero API calls, so a parent who produced a story and listened to the
// whole thing right here never generated a listening_progress row (only
// opening the story again later from the Library did). Wired into the same
// useListeningProgress hook the Library detail pages use, keyed off the
// storyId Studio already resolves the moment production completes
// (Studio2Page.editingStoryId — see handleProductionDone) and the same
// "active child" localStorage key produce-drama itself reads, so a first
// listen right after generation now counts the same way a later Library
// listen does.
export default function StudioAudioBar({
  audioUrl,
  title,
  durationSeconds,
  storyId,
}: {
  audioUrl: string;
  title: string;
  durationSeconds: number;
  storyId?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { markTick, markPause, markEnded } = useListeningProgress({ storyId, audioRef });

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      markPause();
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = +e.target.value;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 pt-6"
      style={{ background: "linear-gradient(to top, #05080F 70%, transparent)", zIndex: 40 }}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => { setCurrentTime(audioRef.current?.currentTime ?? 0); markTick(); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); markEnded(); }}
      />
      <div className="mx-auto px-4 pb-20" style={{ maxWidth: 448 }}>
        <div
          className="rounded-2xl px-4 py-3.5"
          style={{
            background: "rgba(5,8,20,0.92)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handlePlayPause}
              className="w-11 h-11 rounded-full flex items-center justify-center text-fs-heading flex-shrink-0 active:scale-95 transition-transform"
              style={{
                background: "rgba(79,195,247,0.14)",
                border: "1.5px solid rgba(79,195,247,0.45)",
                boxShadow: "0 0 14px rgba(79,195,247,0.3)",
              }}
            >
              {playing ? <Icon name="pause" size={20} /> : <Icon name="play" size={20} />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white text-fs-body font-medium truncate leading-snug">{title}</p>
              <p className="text-fs-body" style={{ color: "rgba(79,195,247,0.6)" }}>Drama ready</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-fs-body w-8 text-right flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || durationSeconds}
              step={0.5}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 cursor-pointer"
              style={{ accentColor: "#4fc3f7" }}
            />
            <span className="text-fs-body w-8 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
              {formatTime(duration || durationSeconds)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
