"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Story Builder ("Quick Story") lives entirely inside Studio's own Create
// toggle now, same as Chat and Step-by-step — this route only exists to
// catch old links/bookmarks and bounce them to the real place.
export default function StoryBuilderPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio?tab=quick-story");
  }, [router]);
  return null;
}
