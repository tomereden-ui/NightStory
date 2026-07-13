"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useViewMode } from "@/context/ViewModeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";
import { t, type TranslationKey } from "@/lib/i18n";
import Icon from "@/components/ui/Icon";

// ── Nav config — each item has its own accent colour ──────────────────────────

const NAV: Array<{
  labelKey: TranslationKey;
  iconName: "navHome" | "navCreate" | "navStories" | "navProfile";
  href: string;
  color: string;
  glow: string;
  bg: string;
}> = [
  {
    labelKey: "home",
    iconName: "navHome",
    href: "/home",
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.4)",
    bg: "rgba(251,191,36,0.12)",
  },
  {
    labelKey: "library",
    iconName: "navStories",
    href: "/library",
    color: "#4fc3f7",
    glow: "rgba(79,195,247,0.4)",
    bg: "rgba(79,195,247,0.12)",
  },
  {
    labelKey: "studioTitle",
    iconName: "navCreate",
    href: "/studio",
    color: "#c084fc",
    glow: "rgba(192,132,252,0.4)",
    bg: "rgba(192,132,252,0.12)",
  },
  {
    labelKey: "profile",
    iconName: "navProfile",
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
  const { guardedNavigate } = useUnsavedChanges();
  const isMobile = effective === "mobile";

  // router.push doesn't update usePathname() until the destination route has
  // fully committed — which in dev includes compiling the target page. With
  // the active pill keyed off pathname alone, a tap produced literally zero
  // visual change for seconds. pendingHref moves the highlight to the tapped
  // tab on the very same frame as the click, then hands off to pathname once
  // the route lands.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => { setPendingHref(null); }, [pathname]);

  // Route every nav click through the unsaved-changes guard — a no-op when no
  // page has registered a guard, so this is safe/free in the common case.
  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (pathname === href || pathname.startsWith(href + "/")) return;
    setPendingHref(href);
    startTransition(() => { guardedNavigate(href); });
  };

  const isItemActive = (href: string) =>
    pendingHref ? pendingHref === href : pathname === href || pathname.startsWith(href + "/");

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
        <span className="text-fs-title mb-5" aria-hidden>🌙</span>

        <ul className="flex flex-col items-center gap-1.5 flex-1">
          {NAV.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={(e) => handleNavClick(e, item.href)} className="flex flex-col items-center gap-1 group" aria-label={t(language, item.labelKey)}>
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
                      <Icon name={item.iconName} size={24} />
                    </span>
                  </span>
                  <span
                    className="text-fs-body font-semibold tracking-wide text-center"
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
          const isActive = isItemActive(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} onClick={(e) => handleNavClick(e, item.href)} className="flex flex-col items-center gap-1 group" aria-label={t(language, item.labelKey)}>
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
                    <Icon name={item.iconName} size={24} />
                  </span>
                </span>
                <span
                  className="text-fs-body font-bold tracking-wide transition-colors duration-200"
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
