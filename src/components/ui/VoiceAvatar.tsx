"use client";

import { useEffect, useRef, useState } from "react";
import { enqueueTurn } from "@/lib/utils/requestQueue";

export interface AvatarStyle {
  key: string;
  gradient: string;
  label: string;
}

export const AVATAR_STYLES: AvatarStyle[] = [
  { key: "azure",  gradient: "linear-gradient(135deg,#1E3A5F,#4FC3F7)", label: "Azure"  },
  { key: "violet", gradient: "linear-gradient(135deg,#2D1B69,#8B5CF6)", label: "Violet" },
  { key: "rose",   gradient: "linear-gradient(135deg,#4A1942,#EC4899)", label: "Rose"   },
  { key: "teal",   gradient: "linear-gradient(135deg,#0D3D3D,#10D9A0)", label: "Teal"   },
  { key: "amber",  gradient: "linear-gradient(135deg,#3D2000,#F59E0B)", label: "Amber"  },
  { key: "indigo", gradient: "linear-gradient(135deg,#1A1A4E,#818CF8)", label: "Indigo" },
  { key: "coral",  gradient: "linear-gradient(135deg,#4A1A00,#F87171)", label: "Coral"  },
  { key: "slate",  gradient: "linear-gradient(135deg,#1A2035,#94A3B8)", label: "Slate"  },
];

const GRADIENT_MAP: Record<string, string> = Object.fromEntries(
  AVATAR_STYLES.map(({ key, gradient }) => [key, gradient])
);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface VoiceAvatarProps {
  avatarUrl?: string;
  emoji: string;
  name?: string;
  size?: number;
  borderColor?: string;
  className?: string;
  onClick?: () => void;
}

const MAX_RETRIES = 2;

export default function VoiceAvatar({
  avatarUrl,
  emoji,
  name = "",
  size = 44,
  borderColor = "rgba(79,195,247,0.25)",
  className = "",
  onClick,
}: VoiceAvatarProps) {
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
    if (attempt < MAX_RETRIES) {
      setAttempt((n) => n + 1);
    } else {
      setGaveUp(true);
    }
  };

  const sharedStyle: React.CSSProperties = {
    width: size,
    height: size,
    border: `1.5px solid ${borderColor}`,
    cursor: onClick ? "pointer" : undefined,
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
        onClick={onClick}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={sharedStyle}
      />
    );
  }

  const gradient = GRADIENT_MAP[emoji];

  if (gradient) {
    const initials = getInitials(name || emoji);
    const fontSize = size * 0.36;
    return (
      <div
        onClick={onClick}
        className={`rounded-full flex items-center justify-center flex-shrink-0 select-none ${className}`}
        style={{
          ...sharedStyle,
          background: gradient,
          fontSize,
          fontWeight: 700,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "0.02em",
          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ ...sharedStyle, fontSize: size * 0.5, background: "rgba(255,255,255,0.06)" }}
    >
      {emoji}
    </div>
  );
}
