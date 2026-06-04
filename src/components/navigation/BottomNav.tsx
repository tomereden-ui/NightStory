"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { NAV_ITEMS } from "@/lib/mockData";

export default function BottomNav() {
  const pathname = usePathname();
  const { language } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-xl border-t border-white/10" />

      <ul className="relative flex items-center justify-around px-2 py-3 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const label = language === "he" ? item.labelHe : item.label;

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-col items-center gap-1 group"
                aria-label={label}
              >
                {/* Icon container */}
                <span
                  className={`
                    relative flex items-center justify-center w-12 h-10 rounded-2xl
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-gold/15 shadow-gold-sm"
                        : "group-hover:bg-white/5"
                    }
                  `}
                >
                  {/* Active indicator pill */}
                  {isActive && (
                    <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-gold" />
                  )}

                  <span
                    className={`text-xl transition-transform duration-200 ${
                      isActive ? "scale-110" : "group-hover:scale-105"
                    }`}
                  >
                    {item.icon}
                  </span>
                </span>

                {/* Label */}
                <span
                  className={`text-[10px] font-medium tracking-wide transition-colors duration-200 ${
                    isActive ? "text-gold" : "text-white/40 group-hover:text-white/60"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
