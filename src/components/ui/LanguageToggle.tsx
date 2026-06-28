"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_META, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types";

function FlagImg({ countryCode, label }: { countryCode: string; label: string }) {
  return (
    <Image
      src={`https://flagcdn.com/32x24/${countryCode}.png`}
      width={20}
      height={15}
      alt={label}
      className="rounded-[2px] flex-shrink-0 object-cover"
      style={{ width: 20, height: 15 }}
      unoptimized
    />
  );
}

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
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-bg-border bg-bg-card hover:border-purple/30 hover:bg-purple/5 transition-all duration-150"
        aria-label="Change language"
      >
        <FlagImg countryCode={current.countryCode} label={current.label} />
        <span className="text-white/70 text-fs-body font-semibold">{current.nativeName}</span>
        <span className="text-white/25 text-fs-body">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-52 rounded-2xl overflow-hidden shadow-card"
          style={{
            background: "#111526",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(139,92,246,0.06)",
          }}
        >
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-white/30 text-fs-body uppercase tracking-widest">Language</p>
          </div>
          <ul className="py-1 max-h-80 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang: Language) => {
              const meta = LANGUAGE_META[lang];
              const isSelected = lang === language;
              return (
                <li key={lang}>
                  <button
                    onClick={() => { setLanguage(lang); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${
                      isSelected ? "bg-purple/10" : "hover:bg-white/5"
                    }`}
                  >
                    <FlagImg countryCode={meta.countryCode} label={meta.label} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-fs-body font-semibold ${isSelected ? "text-purple-bright" : "text-white/80"}`}>
                        {meta.nativeName}
                      </p>
                      <p className="text-fs-body text-white/25">{meta.label}</p>
                    </div>
                    {isSelected && <span className="text-purple-bright text-fs-body flex-shrink-0">✓</span>}
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
