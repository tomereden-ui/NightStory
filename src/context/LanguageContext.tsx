"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Language } from "@/types";
import { t as translate, getDir, SUPPORTED_LANGUAGES, type TranslationKey } from "@/lib/i18n";

const STORAGE_KEY = "nightstory_lang";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "rtl" | "ltr";
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Load persisted language on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
        setLanguageState(saved);
        document.documentElement.lang = saved;
        document.documentElement.dir = getDir(saved);
      }
    } catch {}
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    document.documentElement.lang = lang;
    document.documentElement.dir = getDir(lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(language, key),
    [language]
  );

  const dir = getDir(language);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, dir, isRTL: dir === "rtl" }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
