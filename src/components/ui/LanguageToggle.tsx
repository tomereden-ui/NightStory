"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_META, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = LANGUAGE_META[language];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-bg-border bg-bg-card hover:border-purple/30 hover:bg-purple/5 transition-all duration-150"
        aria-label="Change language"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="text-white/70 text-xs font-semibold">{current.nativeName}</span>
        <span className="text-white/25 text-[9px] ml-0.5">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-44 rounded-2xl overflow-hidden shadow-card"
          style={{
            background: "#111526",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(139,92,246,0.06)",
          }}
        >
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Language</p>
          </div>
          <ul className="py-1 max-h-72 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang: Language) => {
              const meta = LANGUAGE_META[lang];
              const isSelected = lang === language;
              return (
                <li key={lang}>
                  <button
                    onClick={() => { setLanguage(lang); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left ${
                      isSelected ? "bg-purple/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-base leading-none flex-shrink-0">{meta.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${isSelected ? "text-purple-bright" : "text-white/80"}`}>
                        {meta.nativeName}
                      </p>
                      <p className="text-[10px] text-white/25">{meta.label}</p>
                    </div>
                    {isSelected && <span className="text-purple-bright text-xs flex-shrink-0">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
