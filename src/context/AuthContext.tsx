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
          // PKCE verifier may be missing on mobile (different browser context).
          // Fall back to checking if the session was established another way.
          console.warn("[Auth] exchangeCodeForSession failed:", error.message);
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
