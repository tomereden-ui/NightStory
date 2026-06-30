"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { supabaseAuth } from "@/lib/supabaseAuth";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show errors forwarded from the OAuth callback (e.g. email already registered)
  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      setError(authError);
      // Clean the param from the URL so a page refresh doesn't re-show it
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);
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
      if (!consent) { setError("Please confirm you are a parent or guardian and agree to the Privacy Policy."); setLoading(false); return; }
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

  async function handleGoogle() {
    await supabaseAuth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
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

        {/* Google button — shown on sign in and sign up only */}
        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-xl py-3 font-medium transition-opacity hover:opacity-90"
              style={{
                background: "#fff",
                color: "#1f2937",
                fontSize: 15,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {/* Google G logo */}
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 12, color: "rgba(148,163,184,0.5)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
          </>
        )}

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

          {/* Consent checkbox — signup only */}
          {mode === "signup" && (
            <label className="flex items-start gap-3 cursor-pointer" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 rounded"
                style={{ accentColor: "#a78bfa", width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
                I am a parent or guardian and I agree to the{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa", textDecoration: "underline" }}>
                  Privacy Policy
                </a>
                . I consent to data collection for my family, including child profiles.
              </span>
            </label>
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
