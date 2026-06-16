"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { MOCK_USER } from "@/lib/mockData";

function BuildTimestamp() {
  const raw = process.env.NEXT_PUBLIC_BUILD_TIME;
  if (!raw) return null;
  const d = new Date(raw);
  const label =
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="text-white/15 text-[14px] font-mono tracking-wide">v {label}</span>
  );
}

export default function HeroSection() {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative overflow-hidden pt-12 pb-5 px-5">
      {/* Build timestamp — top-left corner */}
      <div className="absolute top-3 left-4">
        <BuildTimestamp />
      </div>

      {/* Top bar */}
      <div className={`flex items-center gap-2.5 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {MOCK_USER.avatarEmoji}
        </div>
        <div>
          <p className="text-white/25 text-[10px] uppercase tracking-widest">Good Night</p>
          <p className="text-white text-sm font-semibold">{MOCK_USER.displayName}</p>
        </div>
      </div>

      {/* Hero */}
      <div className={`text-center mb-5 ${isRTL ? "font-hebrew" : ""}`}>
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-3"
          style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00D4FF" }} />
          <span className="text-xs font-medium tracking-wide" style={{ color: "rgba(0,212,255,0.8)" }}>
            AI Story Generator
          </span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-1.5 leading-tight tracking-tight">
          NightStory
        </h1>
        <p className="text-white/35 text-sm max-w-xs mx-auto">{t("tagline")}</p>

        <div className="flex items-center justify-center gap-3 mt-5">
          <Link
            href="/create"
            className="font-semibold text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#00D4FF,#00A8C8)", color: "#0A0C14", boxShadow: "0 4px 16px rgba(0,212,255,0.35)" }}
          >
            ✨ Create Story
          </Link>
          <Link
            href="/library"
            className="font-semibold text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all"
            style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            📚 Browse
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-8 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { value: "50+", label: "Stories" },
          { value: "4",   label: "AI Voices" },
          { value: "2",   label: "Languages" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-bold text-base leading-none" style={{ color: "#00D4FF" }}>{s.value}</p>
            <p className="text-white/25 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
