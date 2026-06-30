"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

type State = "loading" | "joining" | "success" | "error" | "needsAuth";

export default function JoinPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!token) { setState("error"); setErrorMsg("Invalid invite link — no token found."); return; }

    if (!user) {
      sessionStorage.setItem("pendingInviteToken", token);
      setState("needsAuth");
      return;
    }

    joinFamily();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, token]);

  async function joinFamily() {
    setState("joining");
    const res = await fetch("/api/family/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId: user!.id }),
    });
    const data = await res.json();
    if (!res.ok) { setState("error"); setErrorMsg(data.error ?? "Something went wrong"); return; }
    setState("success");
    setTimeout(() => router.replace("/home"), 2000);
  }

  const card = (content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #040612 0%, #0d0f22 60%, #080b18 100%)" }}>
      <div className="flex flex-col items-center mb-8 gap-3">
        <div className="rounded-2xl flex items-center justify-center"
          style={{ width: 72, height: 72, background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(79,195,247,0.10))", border: "1px solid rgba(167,139,250,0.25)" }}>
          <Image src="/owl-avatar.png" alt="NightStory" width={52} height={52} className="rounded-xl" />
        </div>
        <p className="font-bold" style={{ fontSize: 22, color: "#e2e8f0" }}>NightStory</p>
      </div>
      <div className="w-full rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
        style={{ maxWidth: 380, background: "rgba(13,15,34,0.9)", border: "1px solid rgba(167,139,250,0.18)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        {content}
      </div>
    </div>
  );

  if (state === "loading" || state === "joining") return card(
    <>
      <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      <p style={{ color: "rgba(148,163,184,0.8)", fontSize: 15 }}>
        {state === "joining" ? "Joining family…" : "Verifying invite…"}
      </p>
    </>
  );

  if (state === "needsAuth") return card(
    <>
      <div style={{ fontSize: 40 }}>👨‍👩‍👧‍👦</div>
      <p className="font-bold" style={{ fontSize: 20, color: "#e2e8f0" }}>You&apos;re invited!</p>
      <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
        Sign in or create an account to join this NightStory family.
      </p>
      <button
        onClick={() => router.push(`/login?next=/join?token=${token}`)}
        className="w-full rounded-xl py-3 font-semibold"
        style={{ background: "linear-gradient(135deg, #a78bfa, #4fc3f7)", color: "#fff", fontSize: 15 }}
      >
        Sign in to join
      </button>
    </>
  );

  if (state === "success") return card(
    <>
      <div style={{ fontSize: 48 }}>🎉</div>
      <p className="font-bold" style={{ fontSize: 20, color: "#e2e8f0" }}>You&apos;re in the family!</p>
      <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>Taking you home…</p>
    </>
  );

  return card(
    <>
      <div style={{ fontSize: 40 }}>😕</div>
      <p className="font-bold" style={{ fontSize: 18, color: "#e2e8f0" }}>Invite problem</p>
      <p style={{ color: "#fca5a5", fontSize: 14 }}>{errorMsg}</p>
      <button onClick={() => router.replace("/home")}
        style={{ color: "#a78bfa", fontSize: 14 }}>Go to home →</button>
    </>
  );
}
