"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseAuth } from "@/lib/supabaseAuth";

// Fallback handler for implicit-flow auth links (tokens in URL hash).
// Supabase's client library automatically detects and exchanges hash tokens.
export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Check if this was a password reset (recovery) flow
        const hash = window.location.hash;
        const isRecovery = hash.includes("type=recovery");
        router.replace(isRecovery ? "/set-password" : "/home");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#040612" }}>
      <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
    </div>
  );
}
