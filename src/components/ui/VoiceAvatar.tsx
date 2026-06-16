"use client";

import { useEffect, useRef, useState } from "react";
import { enqueueTurn } from "@/lib/utils/requestQueue";

interface VoiceAvatarProps {
  avatarUrl?: string;
  emoji: string;
  size?: number;
  borderColor?: string;
  className?: string;
}

const MAX_RETRIES = 2;

export default function VoiceAvatar({ avatarUrl, emoji, size = 44, borderColor = "rgba(79,195,247,0.25)", className = "" }: VoiceAvatarProps) {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!avatarUrl) return;
    let cancelled = false;
    setReady(false);
    enqueueTurn().then((release) => {
      if (cancelled) { release(); return; }
      releaseRef.current = release;
      setReady(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrl, attempt]);

  const release = () => {
    releaseRef.current?.();
    releaseRef.current = null;
  };

  const handleError = () => {
    release();
    // Generation is flaky under load — a retry after the request queue has
    // moved on often succeeds where the first attempt timed out.
    if (attempt < MAX_RETRIES) {
      setAttempt((n) => n + 1);
    } else {
      setGaveUp(true);
    }
  };

  if (avatarUrl && ready && !gaveUp) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={attempt}
        src={attempt === 0 ? avatarUrl : `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}retry=${attempt}`}
        alt=""
        onLoad={release}
        onError={handleError}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size, border: `1.5px solid ${borderColor}` }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5, background: "rgba(255,255,255,0.06)", border: `1.5px solid ${borderColor}` }}
    >
      {emoji}
    </div>
  );
}
