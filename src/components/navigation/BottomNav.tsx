"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewMode } from "@/context/ViewModeContext";

const BUILD_LABEL = "Jun 12 · v4";

const NAV = [
  { label: "Magic Tales", icon: "✨", href: "/library" },
  // { label: "Create",  icon: "✨", href: "/create"  },
  { label: "Studio",  icon: "🎬", href: "/studio"  },
  { label: "Studio 2", icon: "🌟", href: "/studio2" },
  { label: "Voices",  icon: "🎙️", href: "/voices"  },
  // { label: "Test",    icon: "🧪", href: "/test"    },
  { label: "Profile", icon: "👤", href: "/profile"  },
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
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

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
                    <span className={`text-xl transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                      style={isActive ? { filter: "drop-shadow(0 0 6px rgba(79,195,247,0.7))" } : {}}>
                      {item.icon}
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
                  <span className={`text-xl transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                    style={isActive ? { filter: "drop-shadow(0 0 6px rgba(79,195,247,0.7))" } : {}}>
                    {item.icon}
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
