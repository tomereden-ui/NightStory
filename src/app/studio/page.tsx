"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy Studio implementation, retired in favor of /studio2 (which has full
// feature parity plus everything built since: moral lessons, character
// profiles, language-aware voice previews, nature-based voice casting).
// Kept as a redirect rather than deleted so old bookmarks/back-history don't
// 404, and so any draft left under the old key isn't silently lost.
export default function LegacyStudioRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      const oldDraft = localStorage.getItem("nightstory_draft_v1");
      const hasNewDraft = localStorage.getItem("nightstory_studio2_draft_v1");
      if (oldDraft && !hasNewDraft) {
        localStorage.setItem("nightstory_studio2_draft_v1", oldDraft);
      }
    } catch { /* ignore storage errors */ }
    router.replace("/studio2");
  }, [router]);

  return null;
}
