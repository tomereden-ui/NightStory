"use client";

import { useState } from "react";

interface VoiceAvatarProps {
  avatarUrl?: string;
  emoji: string;
  size?: number;
  borderColor?: string;
  className?: string;
}

export default function VoiceAvatar({ avatarUrl, emoji, size = 44, borderColor = "rgba(79,195,247,0.25)", className = "" }: VoiceAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (avatarUrl && !failed) {
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
