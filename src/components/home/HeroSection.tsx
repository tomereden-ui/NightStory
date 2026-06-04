"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

export default function HeroSection() {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative overflow-hidden pt-12 pb-5 px-5">
      <StarField count={40} />

      {/* Top bar */}
      <div className={`relative flex items-center justify-between mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="w-9 h-9 rounded-full bg-bg-elevated border border-purple/25 flex items-center justify-center text-lg">
            {MOCK_USER.avatarEmoji}
          </div>
          <div>
            <p className="text-white/25 text-[10px] uppercase tracking-widest">Good Night</p>
            <p className="text-white text-sm font-semibold">{MOCK_USER.displayName}</p>
          </div>
        </div>
        <LanguageToggle />
      </div>

      {/* Hero */}
      <div className={`relative text-center mb-5 ${isRTL ? "font-hebrew" : ""}`}>
        <div className="inline-flex items-center gap-2 bg-teal/8 border border-teal/15 rounded-full px-4 py-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="text-teal/80 text-xs font-medium tracking-wide">AI Story Generator</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-1.5 leading-tight tracking-tight">
          <span className="text-gradient-teal">NightStory</span>
        </h1>
        <p className="text-white/35 text-sm max-w-xs mx-auto">{t("tagline")}</p>

        <div className="flex items-center justify-center gap-3 mt-5">
          <Link href="/create"
            className="text-bg font-semibold text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 16px rgba(139,92,246,0.4)" }}>
            ✨ Create Story
          </Link>
          <Link href="/library"
            className="text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2 border border-white/10 hover:border-white/20 transition-all">
            📚 Browse
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="relative flex items-center justify-center gap-8 pt-4 border-t border-white/5">
        {[
          { value: "50+", label: "Stories" },
          { value: "4", label: "AI Voices" },
          { value: "2", label: "Languages" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-teal font-bold text-base leading-none">{s.value}</p>
            <p className="text-white/25 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
