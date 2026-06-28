"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) { setError(error); setLoading(false); return; }
      router.replace("/home");
    } else if (mode === "signup") {
      const { error } = await signUp(email, password);
      if (error) { setError(error); setLoading(false); return; }
      setSuccess("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setLoading(false);
    } else {
      const { error } = await resetPassword(email);
      if (error) { setError(error); setLoading(false); return; }
      setSuccess("Password reset email sent — check your inbox.");
      setLoading(false);
    }
  }

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password";
  const btnLabel = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #040612 0%, #0d0f22 60%, #080b18 100%)" }}
    >
      {/* Logo */}
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
        <div>
          <p className="text-center font-bold" style={{ fontSize: 26, color: "#e2e8f0", letterSpacing: "-0.3px" }}>
            NightStory
          </p>
          <p className="text-center" style={{ fontSize: 13, color: "rgba(148,163,184,0.7)" }}>
            Magical bedtime stories for families
          </p>
        </div>
      </div>

      {/* Card */}
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
        <h1 className="font-bold mb-6" style={{ fontSize: 20, color: "#e2e8f0" }}>{title}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 13, color: "rgba(148,163,184,0.8)", fontWeight: 500 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
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

          {/* Password */}
          {mode !== "reset" && (
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 13, color: "rgba(148,163,184,0.8)", fontWeight: 500 }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
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
          )}

          {/* Error / Success */}
          {error && (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(34,197,94,0.10)", color: "#86efac", border: "1px solid rgba(34,197,94,0.2)" }}>
              {success}
            </p>
          )}

          {/* Submit */}
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
            {loading ? "Please wait…" : btnLabel}
          </button>
        </form>

        {/* Footer links */}
        <div className="flex flex-col items-center gap-2 mt-5" style={{ fontSize: 13 }}>
          {mode === "signin" && (
            <>
              <button onClick={() => { setMode("signup"); setError(null); setSuccess(null); }} style={{ color: "#a78bfa" }}>
                Don&apos;t have an account? <span className="font-semibold">Sign up</span>
              </button>
              <button onClick={() => { setMode("reset"); setError(null); setSuccess(null); }} style={{ color: "rgba(148,163,184,0.6)" }}>
                Forgot password?
              </button>
            </>
          )}
          {mode === "signup" && (
            <button onClick={() => { setMode("signin"); setError(null); setSuccess(null); }} style={{ color: "#a78bfa" }}>
              Already have an account? <span className="font-semibold">Sign in</span>
            </button>
          )}
          {mode === "reset" && (
            <button onClick={() => { setMode("signin"); setError(null); setSuccess(null); }} style={{ color: "#a78bfa" }}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
