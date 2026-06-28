"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Saves window.scrollY to sessionStorage (keyed by pathname) and restores
// it when the user navigates back to that path.
export default function ScrollRestorer() {
  const pathname = usePathname();
  const rafId = useRef<number>(0);

  // Persist scroll position as the user scrolls
  useEffect(() => {
    const save = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      cancelAnimationFrame(rafId.current);
    };
  }, [pathname]);

  // Restore saved position when pathname changes (i.e. user navigates back)
  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${pathname}`);
    const y = saved ? parseInt(saved, 10) : 0;
    // Two rAF passes let the page paint before scrolling; the timeout
    // covers pages that load data asynchronously after paint.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" });
        // Second attempt after data likely landed
        setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 120);
      })
    );
  }, [pathname]);

  return null;
}
