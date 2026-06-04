"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

export default function HeroSection() {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative overflow-hidden pt-12 pb-6 px-5">
      <StarField count={50} />

      {/* Top bar */}
      <div className={`relative flex items-center justify-between mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="w-9 h-9 rounded-full bg-bg-elevated border border-purple/30 flex items-center justify-center text-lg shadow-purple-sm">
            {MOCK_USER.avatarEmoji}
          </div>
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Good Night</p>
            <p className="text-white text-sm font-semibold">{MOCK_USER.displayName}</p>
          </div>
        </div>
        <LanguageToggle />
      </div>

      {/* Hero */}
      <div className={`relative text-center mb-6 ${isRTL ? "font-hebrew" : ""}`}>
        <div className="inline-flex items-center gap-2 bg-purple/10 border border-purple/20 rounded-full px-4 py-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="text-teal text-xs font-medium tracking-wide">AI Story Generator</span>
        </div>

        <h1 className="text-4xl font-bold text-white mb-2 leading-tight tracking-tight">
          <span className="text-gradient-teal">NightStory</span>
        </h1>
        <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
          {t("tagline")}
        </p>

        <div className="flex items-center justify-center gap-3 mt-5">
          <Link href="/create" className="btn-vivid text-sm px-5 py-2.5 inline-flex items-center gap-2">
            <span>✨</span> Create Story
          </Link>
          <Link href="/library" className="btn-outline text-sm px-5 py-2.5 inline-flex items-center gap-2">
            <span>📚</span> Browse
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="relative flex items-center justify-center gap-8 pt-4 border-t border-white/5">
        {[
          { value: "50+", label: "Stories" },
          { value: "4", label: "AI Voices" },
          { value: "2", label: "Languages" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-teal font-bold text-lg leading-none">{stat.value}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
