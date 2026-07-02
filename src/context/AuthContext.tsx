"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabaseAuth } from "@/lib/supabaseAuth";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Exchange OAuth/magic-link code if present in URL (e.g. after Google login)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    const init = async () => {
      if (code) {
        // Clean code from URL immediately so a page refresh doesn't try to reuse it
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());

        const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn("[Auth] exchangeCodeForSession failed:", error.message);
          // If Supabase rejected the code (e.g. email already registered under a different
          // provider), redirect to login with the error so the user sees what went wrong.
          if (error.message && !error.message.toLowerCase().includes("verifier")) {
            const url = new URL(window.location.href);
            url.pathname = "/login";
            url.searchParams.set("auth_error", error.message);
            window.location.replace(url.toString());
            return;
          }
          // PKCE verifier missing (different browser context) — check if session already set
          const { data: fallback } = await supabaseAuth.auth.getSession();
          setSession(fallback.session);
          setUser(fallback.session?.user ?? null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } else {
        const { data } = await supabaseAuth.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Mirror the access token into a cookie so Next.js middleware can read
      // it for route-level auth protection (localStorage isn't accessible
      // server-side). Cookie is Strict + Secure; httpOnly is intentionally
      // omitted so the client can clear it on sign-out.
      if (session?.access_token) {
        const maxAge = session.expires_in ?? 3600;
        document.cookie = `ns-session=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Strict`;
      } else {
        document.cookie = "ns-session=; path=/; max-age=0; SameSite=Strict";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabaseAuth.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
