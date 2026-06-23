"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewMode } from "@/context/ViewModeContext";
import { useLanguage } from "@/context/LanguageContext";
import { t, type TranslationKey } from "@/lib/i18n";

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconStories() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Open book */}
      <path d="M12 6C10 3.5 6 3 3 4v15c3-1 7-.5 9 2 2-2.5 6-3 9-2V4c-3-1-7-.5-9 2z" />
      <path d="M12 6v15" />
      {/* Star on right page */}
      <path d="M16.5 9l.55 1.65L18.7 11l-1.65.55L16.5 13.2l-.55-1.65L14.3 11l1.65-.55z" />
    </svg>
  );
}

function IconCreate() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Wand */}
      <path d="M5 19L15 9" />
      <path d="M13.5 7.5l3 3" />
      <path d="M15 6l1 1" />
      {/* Sparkles */}
      <path d="M9 3l.6 1.8L11.4 5l-1.8.6L9 7.4 8.4 5.6 6.6 5l1.8-.6z" />
      <path d="M19 9l.4 1.2 1.2.4-1.2.4L19 12.2l-.4-1.2-1.2-.4 1.2-.4z" />
      <path d="M4 13l.35 1.05.7.2.35 1.05.35-1.05 1.05-.2-.7-.2z" />
    </svg>
  );
}

function IconVoices() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Microphone */}
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1a7 7 0 0014 0v-1" />
      <path d="M12 19v3" />
      <path d="M9 22h6" />
      {/* Music notes floating */}
      <path d="M19 6l1-1v3" />
      <circle cx="20" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
      <path d="M21 4l1-1v2.5" />
      <circle cx="22" cy="5.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMe() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Moon */}
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      {/* Stars */}
      <path d="M17 4l.4 1.2 1.2.4-1.2.4L17 7.2l-.4-1.2-1.2-.4 1.2-.4z" />
      <circle cx="19.5" cy="9" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ── Nav config — each item has its own accent colour ──────────────────────────

const NAV: Array<{
  labelKey: TranslationKey;
  Icon: () => React.ReactElement;
  href: string;
  color: string;
  glow: string;
  bg: string;
}> = [
  {
    labelKey: "navStoryTime",
    Icon: IconStories,
    href: "/library",
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.4)",
    bg: "rgba(251,191,36,0.12)",
  },
  {
    labelKey: "navCreate",
    Icon: IconCreate,
    href: "/studio2",
    color: "#c084fc",
    glow: "rgba(192,132,252,0.4)",
    bg: "rgba(192,132,252,0.12)",
  },
  {
    labelKey: "navVoices",
    Icon: IconVoices,
    href: "/voices",
    color: "#f472b6",
    glow: "rgba(244,114,182,0.4)",
    bg: "rgba(244,114,182,0.12)",
  },
  {
    labelKey: "navMySpace",
    Icon: IconMe,
    href: "/profile",
    color: "#67e8f9",
    glow: "rgba(103,232,249,0.4)",
    bg: "rgba(103,232,249,0.12)",
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { effective } = useViewMode();
  const { language } = useLanguage();
  const isMobile = effective === "mobile";

  if (!isMobile) {
    return (
      <nav
        className="flex flex-col items-center w-20 lg:w-24 shrink-0 sticky top-0 h-screen z-50 py-6 gap-1"
        style={{
          background: "rgba(5,8,20,0.92)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <span className="text-2xl mb-5" aria-hidden>🌙</span>

        <ul className="flex flex-col items-center gap-1.5 flex-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link href={item.href} className="flex flex-col items-center gap-1 group" aria-label={t(language, item.labelKey)}>
                  <span
                    className="relative flex items-center justify-center w-12 h-10 rounded-2xl transition-all duration-200"
                    style={isActive ? {
                      background: item.bg,
                      boxShadow: `0 0 18px ${item.glow}`,
                    } : {}}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-7 rounded-full"
                        style={{ background: item.color, boxShadow: `0 0 8px ${item.glow}` }}
                      />
                    )}
                    <span
                      className={`transition-all duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                      style={{
                        color: isActive ? item.color : "rgba(255,255,255,0.3)",
                        filter: isActive ? `drop-shadow(0 0 6px ${item.glow})` : undefined,
                      }}
                    >
                      <item.Icon />
                    </span>
                  </span>
                  <span
                    className="text-[9px] font-semibold tracking-wide text-center"
                    style={{ color: isActive ? item.color : "rgba(255,255,255,0.25)" }}
                  >
                    {t(language, item.labelKey)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to top, rgba(4,6,18,0.98) 60%, rgba(5,8,20,0.88) 100%)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      />

      <ul className="relative flex items-end justify-around px-1 pt-2 pb-3">
        {NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link href={item.href} className="flex flex-col items-center gap-1 group" aria-label={t(language, item.labelKey)}>
                <span
                  className="relative flex items-center justify-center w-14 h-11 rounded-2xl transition-all duration-200"
                  style={isActive ? {
                    background: item.bg,
                    boxShadow: `0 0 20px ${item.glow}, 0 0 8px ${item.glow}`,
                  } : {}}
                >
                  {/* Active glow dot indicator */}
                  {isActive && (
                    <span
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                      style={{ background: item.color, boxShadow: `0 0 8px ${item.glow}` }}
                    />
                  )}
                  <span
                    className={`transition-all duration-200 ${isActive ? "scale-110" : "scale-95 group-hover:scale-100"}`}
                    style={{
                      color: isActive ? item.color : "rgba(255,255,255,0.28)",
                      filter: isActive ? `drop-shadow(0 0 8px ${item.glow})` : undefined,
                    }}
                  >
                    <item.Icon />
                  </span>
                </span>
                <span
                  className="text-[9px] font-bold tracking-wide transition-colors duration-200"
                  style={{ color: isActive ? item.color : "rgba(255,255,255,0.22)" }}
                >
                  {t(language, item.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
