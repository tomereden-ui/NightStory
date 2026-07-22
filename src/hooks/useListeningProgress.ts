"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  storyId: string | null | undefined;
  audioRef: React.RefObject<HTMLAudioElement>;
}

interface ProgressRow {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

const WRITE_INTERVAL_MS = 12_000;
const MIN_POSITION_TO_PERSIST = 5; // don't litter rows for accidental taps
const MIN_POSITION_TO_RESUME = 5;  // don't offer "resume" for a false start

function activeChildId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ns-active-child-id");
}

/**
 * Continuously marks playback position per (story, active child) so a story
 * can resume where it left off. Wire the returned handlers into the page's
 * existing <audio> event props rather than attaching separate listeners —
 * JSX only allows one onX handler per element.
 */
export function useListeningProgress({ storyId, audioRef }: Options) {
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const lastWriteRef = useRef(0);
  const hasSeekedRef = useRef(false);

  const persist = useCallback((overrides?: { completed?: boolean }) => {
    const audio = audioRef.current;
    const childId = activeChildId();
    if (!audio || !childId || !storyId) return;

    const position = audio.currentTime;
    const duration = audio.duration;
    if (!Number.isFinite(position) || position < MIN_POSITION_TO_PERSIST) return;

    // expo-av-style exact-end timing is unreliable on the web too (metadata
    // durations can be a hair off) — 95% or duration-1s, whichever hits first.
    const completed = overrides?.completed ?? (
      Number.isFinite(duration) && duration > 0 &&
      (position >= duration - 1 || position / duration >= 0.95)
    );

    fetch("/api/listening-progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        childId,
        positionSeconds: completed ? duration : position,
        durationSeconds: Number.isFinite(duration) ? duration : undefined,
        completed,
      }),
      keepalive: true, // survive an actual tab-close, not just SPA navigation
    }).catch(() => {});
  }, [storyId, audioRef]);

  // Fetch any saved position once per story, to offer resume.
  useEffect(() => {
    hasSeekedRef.current = false;
    setResumeFrom(null);
    const childId = activeChildId();
    if (!childId || !storyId) return;
    let cancelled = false;
    fetch(`/api/listening-progress?storyId=${encodeURIComponent(storyId)}&childId=${encodeURIComponent(childId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row: ProgressRow | null) => {
        if (cancelled || !row) return;
        if (!row.completed && row.positionSeconds > MIN_POSITION_TO_RESUME) {
          setResumeFrom(row.positionSeconds);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storyId]);

  // Call once metadata/duration is known — seeks to the saved position exactly once.
  // Some streamed mp3s (depending on how they were encoded/muxed during
  // production) report duration as NaN or Infinity right at loadedmetadata,
  // before the browser has actually determined the real length — seeking
  // against that silently no-ops instead of erroring. The old truthy check
  // (`audio.duration && ...`) treated Infinity as "known" and still committed
  // hasSeekedRef even when the seek couldn't actually land, so those specific
  // files would permanently reset to 0:00 while others (with an accurate
  // duration already available) resumed fine — a per-file, not random, split.
  // Only commit hasSeekedRef once duration is a real finite number; the
  // durationchange listener below re-fires this exactly when that resolves.
  const applyResumeSeek = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasSeekedRef.current || resumeFrom == null) return;
    if (!Number.isFinite(audio.duration)) return;
    hasSeekedRef.current = true;
    if (resumeFrom < audio.duration - 1) {
      audio.currentTime = resumeFrom;
    }
  }, [audioRef, resumeFrom]);

  // The page's onLoadedMetadata handler is the primary call site above, but
  // that DOM event only fires once — if the audio's metadata loads faster
  // than this hook's own saved-position fetch (very possible for a cached/
  // short mp3 vs a network round-trip), resumeFrom is still null when it
  // fires, the seek is skipped, and nothing ever calls applyResumeSeek again
  // — the story silently opens at 0:00 instead of resuming. This retries the
  // seek as soon as resumeFrom itself resolves, by which point audio.duration
  // is normally already set if metadata won that race instead.
  useEffect(() => {
    if (resumeFrom != null) applyResumeSeek();
  }, [resumeFrom, applyResumeSeek]);

  // Throttled — call from onTimeUpdate (fires several times/sec); cheap no-op
  // between writes.
  const markTick = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current < WRITE_INTERVAL_MS) return;
    lastWriteRef.current = now;
    persist();
  }, [persist]);

  const markPause = useCallback(() => persist(), [persist]);
  const markEnded = useCallback(() => persist({ completed: true }), [persist]);
  const clearResumePrompt = useCallback(() => setResumeFrom(null), []);

  // Flush on tab hide (backgrounding-equivalent) and on unmount — the latter
  // covers in-app navigation away from the page, which is a client-side route
  // change, not a real page unload, so visibilitychange/beforeunload alone
  // would miss it.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "hidden") persist(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      persist();
    };
  }, [persist]);

  return { resumeFrom, markTick, markPause, markEnded, applyResumeSeek, clearResumePrompt };
}
