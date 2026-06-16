"use client";

import { useEffect, useState } from "react";

interface VoiceAvatarProps {
  avatarUrl?: string;
  emoji: string;
  size?: number;
  borderColor?: string;
  className?: string;
  /** Delay (ms) before requesting the image — stagger many avatars on one screen to avoid overloading generation. */
  delayMs?: number;
}

export default function VoiceAvatar({ avatarUrl, emoji, size = 44, borderColor = "rgba(79,195,247,0.25)", className = "", delayMs = 0 }: VoiceAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (avatarUrl && ready && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        onError={() => setFailed(true)}
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
