"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type FontScale = "small" | "medium" | "large";

const BASE = {
  title:   24,   // story titles, hero headings
  heading: 18,   // card titles, modal headers
  body:    14,   // script lines, chat messages, summaries
  caption: 11,   // character labels, timestamps, metadata
  label:   10,   // nav labels, tab names, section markers (uppercase)
  micro:    9,   // badges, SFX pill, status dots
} as const;

const MULTIPLIERS: Record<FontScale, number> = { small: 0.85, medium: 1.0, large: 1.2 };
export type FontSizes = { [K in keyof typeof BASE]: number };

interface FontSizeCtx { scale: FontScale; setScale: (s: FontScale) => void; fs: FontSizes; }
const FontSizeContext = createContext<FontSizeCtx>({ scale: "medium", setScale: () => {}, fs: { ...BASE } });

function compute(scale: FontScale): FontSizes {
  const m = MULTIPLIERS[scale];
  return Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, Math.round(v * m)])) as FontSizes;
}

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<FontScale>("medium");
  const [fs, setFs] = useState<FontSizes>({ ...BASE });

  useEffect(() => {
    const stored = localStorage.getItem("ns_font_scale") as FontScale | null;
    if (stored && stored in MULTIPLIERS) { setScaleState(stored); setFs(compute(stored)); }
  }, []);

  useEffect(() => {
    const sizes = compute(scale);
    const root = document.documentElement;
    (Object.entries(sizes) as [string, number][]).forEach(([k, v]) => root.style.setProperty(`--fs-${k}`, `${v}px`));
    setFs(sizes);
  }, [scale]);

  const setScale = (s: FontScale) => { setScaleState(s); localStorage.setItem("ns_font_scale", s); };
  return <FontSizeContext.Provider value={{ scale, setScale, fs }}>{children}</FontSizeContext.Provider>;
}

export function useFontSize() { return useContext(FontSizeContext); }
