"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Old route name, kept as a redirect so old bookmarks/back-history don't
// 404 — the real Studio now lives at /studio (see src/app/studio/page.tsx).
export default function LegacyStudio2Redirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/studio");
  }, [router]);

  return null;
}
