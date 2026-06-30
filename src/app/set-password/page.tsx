"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabaseAuth } from "@/lib/supabaseAuth";

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      // Exchange the code in the browser so the session is stored locally
      supabaseAuth.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) { router.replace("/login"); return; }
        setChecking(false);
      });
    } else {
      supabaseAuth.auth.getSession().then(({ data }) => {
        if (!data.session) router.replace("/login");
        else setChecking(false);
      });
    }
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { error } = await supabaseAuth.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.replace("/home");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040612" }}>
        <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #040612 0%, #0d0f22 60%, #080b18 100%)" }}
    >
      <div className="flex flex-col items-center mb-10 gap-3">
        <div
          className="rounded-2xl flex items-center justify-center"
          style={{
            width: 72, height: 72,
            background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(79,195,247,0.10))",
            border: "1px solid rgba(167,139,250,0.25)",
          }}
        >
          <Image src="/owl-avatar.png" alt="NightStory" width={52} height={52} className="rounded-xl" />
        </div>
        <p className="text-center font-bold" style={{ fontSize: 26, color: "#e2e8f0" }}>NightStory</p>
      </div>

      <div
        className="w-full rounded-2xl p-6"
        style={{
          maxWidth: 400,
          background: "rgba(13,15,34,0.9)",
          border: "1px solid rgba(167,139,250,0.18)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
        }}
      >
        <h1 className="font-bold mb-2" style={{ fontSize: 20, color: "#e2e8f0" }}>Set your password</h1>
        <p className="mb-6" style={{ fontSize: 13, color: "rgba(148,163,184,0.7)" }}>
          Choose a password to use next time you sign in.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { label: "Password", value: password, onChange: setPassword, placeholder: "Min. 8 characters" },
            { label: "Confirm password", value: confirm, onChange: setConfirm, placeholder: "Repeat password" },
          ].map(({ label, value, onChange, placeholder }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label style={{ fontSize: 13, color: "rgba(148,163,184,0.8)", fontWeight: 500 }}>{label}</label>
              <input
                type="password"
                required
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="rounded-xl px-4 py-3 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(167,139,250,0.2)",
                  color: "#e2e8f0",
                  fontSize: 15,
                }}
                onFocus={e => (e.currentTarget.style.border = "1px solid rgba(167,139,250,0.6)")}
                onBlur={e => (e.currentTarget.style.border = "1px solid rgba(167,139,250,0.2)")}
              />
            </div>
          ))}

          {error && (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl py-3 font-semibold transition-opacity"
            style={{
              background: "linear-gradient(135deg, #a78bfa, #4fc3f7)",
              color: "#fff",
              fontSize: 15,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
