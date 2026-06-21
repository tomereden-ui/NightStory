"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewMode } from "@/context/ViewModeContext";

const BUILD_LABEL = "Jun 12 · v4";

// ── Magical SVG icons ──────────────────────────────────────────────────────────

function IconMagicTales() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M12 9l.7 2.1 2.2.3-1.6 1.5.4 2.2L12 14l-1.7 1.1.4-2.2-1.6-1.5 2.2-.3z" />
    </svg>
  );
}

function IconStudio() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l9-9" />
      <path d="M10.5 13.5l7.5-7.5a2.121 2.121 0 00-3-3L7.5 10.5" />
      <path d="M16 3l.5 1.5L18 5l-1.5.5L16 7l-.5-1.5L14 5l1.5-.5z" />
      <path d="M20 10l.4 1.2 1.2.4-1.2.4L20 13.2l-.4-1.2-1.2-.4 1.2-.4z" />
      <path d="M4 6l.4 1.2 1.2.4-1.2.4L4 9.2l-.4-1.2-1.2-.4 1.2-.4z" />
    </svg>
  );
}

function IconVoices() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
      <path d="M18 5l1.5-1.5" />
      <path d="M19 8.5h1.5" />
      <path d="M18 12l1.5 1.5" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      <path d="M17.5 3.5l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4z" />
    </svg>
  );
}

const NAV = [
  { label: "Magic Tales", Icon: IconMagicTales, href: "/library" },
  { label: "Studio 2",    Icon: IconStudio,     href: "/studio2" },
  { label: "Voices",      Icon: IconVoices,     href: "/voices"  },
  { label: "Profile",     Icon: IconProfile,    href: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { effective } = useViewMode();
  const isMobile = effective === "mobile";

  const buildBadge = process.env.NEXT_PUBLIC_BUILD_TIME
    ? (() => {
        const d = new Date(process.env.NEXT_PUBLIC_BUILD_TIME!);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
          + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      })()
    : BUILD_LABEL;

  if (!isMobile) {
    return (
      <nav
        className="flex flex-col items-center w-20 lg:w-24 shrink-0 sticky top-0 h-screen z-50 py-6 gap-1"
        style={{
          background: "rgba(5,8,20,0.9)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <span className="text-2xl mb-4" aria-hidden>🌙</span>

        <ul className="flex flex-col items-center gap-2 flex-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));

            return (
              <li key={item.href}>
                <Link href={item.href} className="flex flex-col items-center gap-1 group" aria-label={item.label}>
                  <span
                    className="relative flex items-center justify-center w-12 h-10 rounded-2xl transition-all"
                    style={isActive ? {
                      background: "rgba(79,195,247,0.1)",
                      boxShadow: "0 0 12px rgba(79,195,247,0.15)",
                    } : {}}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full"
                        style={{ background: "#4fc3f7", boxShadow: "0 0 6px rgba(79,195,247,0.7)" }}
                      />
                    )}
                    <span
                      className={`transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                      style={{
                        color: isActive ? "#4fc3f7" : "rgba(255,255,255,0.35)",
                        filter: isActive ? "drop-shadow(0 0 6px rgba(79,195,247,0.7))" : undefined,
                      }}
                    >
                      <item.Icon />
                    </span>
                  </span>
                  <span
                    className="text-[10px] font-medium tracking-wide"
                    style={{ color: isActive ? "#4fc3f7" : "rgba(255,255,255,0.28)" }}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded-full text-center"
          style={{
            background: "rgba(79,195,247,0.08)",
            color: "rgba(79,195,247,0.55)",
            border: "1px solid rgba(79,195,247,0.15)",
          }}
        >
          {buildBadge}
        </span>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(5,8,20,0.9)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      />

      {/* Version badge */}
      <div className="relative flex justify-center pt-1.5">
        <span
          className="text-[9px] font-mono px-2.5 py-0.5 rounded-full"
          style={{
            background: "rgba(79,195,247,0.08)",
            color: "rgba(79,195,247,0.55)",
            border: "1px solid rgba(79,195,247,0.15)",
          }}
        >
          {buildBadge}
        </span>
      </div>

      <ul className="relative flex items-center justify-around px-2 pt-0 pb-2">
        {NAV.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <li key={item.href}>
              <Link href={item.href} className="flex flex-col items-center gap-0.5 group" aria-label={item.label}>
                <span
                  className="relative flex items-center justify-center w-12 h-9 rounded-2xl transition-all"
                  style={isActive ? {
                    background: "rgba(79,195,247,0.1)",
                    boxShadow: "0 0 12px rgba(79,195,247,0.15)",
                  } : {}}
                >
                  {isActive && (
                    <span
                      className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                      style={{ background: "#4fc3f7", boxShadow: "0 0 6px rgba(79,195,247,0.7)" }}
                    />
                  )}
                  <span
                    className={`transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                    style={{
                      color: isActive ? "#4fc3f7" : "rgba(255,255,255,0.35)",
                      filter: isActive ? "drop-shadow(0 0 6px rgba(79,195,247,0.7))" : undefined,
                    }}
                  >
                    <item.Icon />
                  </span>
                </span>
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? "#4fc3f7" : "rgba(255,255,255,0.28)" }}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
