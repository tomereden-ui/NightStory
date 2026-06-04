"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === "en" ? "he" : "en")}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-gold/30 hover:bg-gold/5 transition-all duration-150"
      aria-label="Toggle language"
    >
      <span className="text-sm">{language === "en" ? "🇺🇸" : "🇮🇱"}</span>
      <span className="text-white/60 text-xs font-medium">
        {language === "en" ? "EN" : "HE"}
      </span>
    </button>
  );
}
