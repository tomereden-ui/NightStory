import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Handles OAuth (Google etc.), email confirmation, and password-reset redirects.
// The code is passed to a client-side page so the browser exchanges it and
// stores the session in localStorage (server-side exchange doesn't persist).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  // Supabase / Google sends error params when OAuth fails (e.g. email already registered
  // with a different provider, user denied access, etc.)
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");
  if (oauthError) {
    const msg = oauthErrorDesc ?? oauthError;
    return NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(msg)}`);
  }

  if (code) {
    // Password reset / invite → set-password page (exchanges code + sets password)
    // Google OAuth / email confirmation → home page (exchanges code + logs in)
    const type = searchParams.get("type");
    const isPasswordFlow = type === "recovery" || type === "invite" || next === "/set-password";
    const destination = isPasswordFlow ? `/set-password?code=${code}` : `/home?code=${code}`;
    return NextResponse.redirect(`${origin}${destination}`);
  }

  // No code — send to client-side handler that reads hash tokens (implicit flow fallback)
  return NextResponse.redirect(`${origin}/auth/confirm`);
}
