"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Library",  icon: "📚", href: "/library"  },
  { label: "Discover", icon: "🔍", href: "/"          },
  { label: "Sleep",    icon: "🌙", href: "/player"    },
  { label: "Profile",  icon: "👤", href: "/profile"   },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(10,12,20,0.92)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      />
      <ul className="relative flex items-center justify-around px-2 py-2">
        {NAV.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex flex-col items-center gap-1 group"
                aria-label={item.label}
              >
                <span
                  className="relative flex items-center justify-center w-12 h-10 rounded-2xl transition-all"
                  style={isActive ? { background: "rgba(0,212,255,0.08)" } : {}}
                >
                  {isActive && (
                    <span
                      className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                      style={{ background: "#00D4FF" }}
                    />
                  )}
                  <span className={`text-xl transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`}>
                    {item.icon}
                  </span>
                </span>
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? "#00D4FF" : "rgba(255,255,255,0.28)" }}
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
