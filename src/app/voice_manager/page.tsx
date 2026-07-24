"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Voice Manager now lives inside Admin Services > Voices — this route only
// exists to catch old links/bookmarks and bounce them to the real place.
export default function VoiceManagerPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin?tab=services");
  }, [router]);
  return null;
}
