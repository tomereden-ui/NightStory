"use client";

import { useMemo } from "react";

interface Star {
  id: number;
  top: string;
  left: string;
  size: string;
  delay: string;
  opacity: string;
}

export default function StarField({ count = 40 }: { count?: number }) {
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      top: `${(i * 37 + 11) % 100}%`,
      left: `${(i * 61 + 7) % 100}%`,
      size: i % 5 === 0 ? "2px" : i % 3 === 0 ? "1.5px" : "1px",
      delay: `${(i * 0.3) % 3}s`,
      opacity: `${0.2 + (i % 4) * 0.15}`,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {stars.map((star) => (
        <span
          key={star.id}
          className="star-dot"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  );
}
