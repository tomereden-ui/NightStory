"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type FontScale = "small" | "medium" | "large";

// Medium (1.0×) base values in px — scaled by multiplier for small/large
const BASE = {
  display:  32,  // hero greeting, massive single-line title
  title:    24,  // page/story titles
  subtitle: 20,  // section/modal titles, prominent card labels
  heading:  17,  // sub-section headers, form labels
  body:     14,  // body text, chat messages, descriptions
  label:    12,  // UI labels, tabs, small buttons
  caption:  10,  // captions, timestamps, metadata badges
  micro:     9,  // avatar name chips, badge pills, status dots
} as const;

const MULTIPLIERS: Record<FontScale, number> = { small: 0.85, medium: 1.0, large: 1.2 };
export type FontSizes = { [K in keyof typeof BASE]: number };

interface FontSizeCtx { scale: FontScale; setScale: (s: FontScale) => void; fs: FontSizes; }
const FontSizeContext = createContext<FontSizeCtx>({ scale: "medium", setScale: () => {}, fs: { ...BASE } });

function compute(scale: FontScale): FontSizes {
  const m = MULTIPLIERS[scale];
  return Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, Math.round(v * m)])) as FontSizes;
}

function applyCssVars(sizes: FontSizes) {
  const root = document.documentElement;
  (Object.entries(sizes) as [string, number][]).forEach(([k, v]) =>
    root.style.setProperty(`--fs-${k}`, `${v}px`)
  );
}

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<FontScale>("medium");
  const [fs, setFs] = useState<FontSizes>({ ...BASE });

  useEffect(() => {
    const stored = localStorage.getItem("ns_font_scale") as FontScale | null;
    if (stored && stored in MULTIPLIERS) {
      const sizes = compute(stored);
      setScaleState(stored);
      setFs(sizes);
      applyCssVars(sizes);
    }
  }, []);

  useEffect(() => {
    const sizes = compute(scale);
    applyCssVars(sizes);
    setFs(sizes);
  }, [scale]);

  const setScale = (s: FontScale) => { setScaleState(s); localStorage.setItem("ns_font_scale", s); };
  return <FontSizeContext.Provider value={{ scale, setScale, fs }}>{children}</FontSizeContext.Provider>;
}

export function useFontSize() { return useContext(FontSizeContext); }
