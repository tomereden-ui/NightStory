"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type ViewMode = "auto" | "mobile" | "tablet" | "desktop";
export type EffectiveView = "mobile" | "tablet" | "desktop";

interface ViewModeContextValue {
  mode: ViewMode;
  effective: EffectiveView;
  setMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);
const STORAGE_KEY = "nightstory_view_mode";

function detectFromWidth(width: number): EffectiveView {
  if (width >= 1024) return "desktop";
  if (width >= 768) return "tablet";
  return "mobile";
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("auto");
  const [autoEffective, setAutoEffective] = useState<EffectiveView>("mobile");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    if (stored === "auto" || stored === "mobile" || stored === "tablet" || stored === "desktop") {
      setModeState(stored);
    }
  }, []);

  useEffect(() => {
    const update = () => setAutoEffective(detectFromWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const effective: EffectiveView = mode === "auto" ? autoEffective : mode;

  return (
    <ViewModeContext.Provider value={{ mode, effective, setMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
