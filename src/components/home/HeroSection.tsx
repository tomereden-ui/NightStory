"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

export default function HeroSection() {
  const { t, isRTL } = useLanguage();

  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "🌙" : hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";

  return (
    <section className="relative overflow-hidden pt-12 pb-8 px-5">
      <StarField count={50} />

      {/* Top bar */}
      <div
        className={`relative flex items-center justify-between mb-8 ${
          isRTL ? "flex-row-reverse" : ""
        }`}
      >
        {/* User greeting */}
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="w-9 h-9 rounded-full bg-navy-lighter border border-gold/20 flex items-center justify-center text-lg">
            {MOCK_USER.avatarEmoji}
          </div>
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">
              {greeting} {t("goodNight")}
            </p>
            <p className="text-white text-sm font-semibold">
              {MOCK_USER.displayName}
            </p>
          </div>
        </div>

        <LanguageToggle />
      </div>

      {/* Hero text */}
      <div className={`relative text-center mb-8 ${isRTL ? "font-hebrew" : ""}`}>
        {/* Moon decoration */}
        <div className="text-6xl mb-3 animate-pulse-slow">🌙</div>

        <h1 className="text-3xl font-bold text-white mb-2 leading-tight">
          <span className="text-gradient-gold">{t("appName")}</span>
        </h1>
        <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
          {t("tagline")}
        </p>

        {/* CTA */}
        <Link
          href="/library"
          className="btn-gold inline-flex items-center gap-2 mt-6 text-sm"
        >
          <span>✨</span>
          {t("listenNow")}
        </Link>
      </div>

      {/* Stats row */}
      <div className="relative flex items-center justify-center gap-6 pt-4 border-t border-white/5">
        {[
          { value: "50+", label: t("allStories") },
          { value: "4", label: "Voices" },
          { value: "∞", label: "Dreams" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-gold font-bold text-lg leading-none">{stat.value}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
