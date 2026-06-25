"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useViewMode } from "@/context/ViewModeContext";
import BottomNav from "@/components/navigation/BottomNav";

const CONTAINER_WIDTH: Record<string, number> = {
  mobile: 448,
  tablet: 672,
  desktop: 896,
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { effective } = useViewMode();
  const pathname = usePathname();
  const isMobile = effective === "mobile";
  const isSplash = pathname === "/";

  return (
    <div
      className={`flex min-h-screen relative ${isMobile ? "flex-col" : "flex-row"}`}
      style={{ background: "#0A0C14" }}
    >
      {!isSplash && <BottomNav />}
      <main className={`flex-1 overflow-x-clip ${isMobile && !isSplash ? "pb-24" : "pb-8"}`}>
        <div
          className="mx-auto"
          style={{
            maxWidth: CONTAINER_WIDTH[effective],
            paddingLeft: isMobile ? 0 : 24,
            paddingRight: isMobile ? 0 : 24,
            paddingTop: isMobile ? 0 : 24,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
