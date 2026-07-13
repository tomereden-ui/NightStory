"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useViewMode } from "@/context/ViewModeContext";
import { useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/navigation/BottomNav";
import ScrollRestorer from "@/components/layout/ScrollRestorer";

const CONTAINER_WIDTH: Record<string, number> = {
  mobile: 448,
  tablet: 672,
  desktop: 896,
};

const PUBLIC_PATHS = ["/", "/login", "/set-password", "/auth/confirm", "/join", "/privacy"];

export default function AppShell({ children }: { children: ReactNode }) {
  const { effective } = useViewMode();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = effective === "mobile";
  const isPublicPath = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/story/");

  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      router.replace("/login");
    }
  }, [loading, user, isPublicPath, router]);

  // On auth-gated pages, show nothing while session is loading or redirecting
  if (!isPublicPath && (loading || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0C14" }}>
        <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Auth/invite/onboarding pages and public story share pages render full-screen with no chrome
  if (["/login", "/set-password", "/auth/confirm", "/join", "/onboarding"].includes(pathname) || pathname.startsWith("/story/")) {
    return <>{children}</>;
  }

  return (
    <div
      className={`flex min-h-screen relative ${isMobile ? "flex-col" : "flex-row"}`}
      style={{ background: "#0A0C14" }}
    >
      <ScrollRestorer />
      {pathname !== "/" && <BottomNav />}
      <main className={`flex-1 overflow-x-clip ${isMobile && pathname !== "/" ? "pb-24" : "pb-8"}`}>
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
