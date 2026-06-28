import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Handles OAuth (Google etc.), email confirmation, and password-reset redirects.
// The code is passed to a client-side page so the browser exchanges it and
// stores the session in localStorage (server-side exchange doesn't persist).
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    // Google OAuth → go straight to /home after exchange
    // Password reset / invite → go to /set-password to set a password
    const isPasswordFlow = next === "/set-password" ||
      searchParams.get("type") === "recovery" ||
      searchParams.get("type") === "invite";

    const destination = isPasswordFlow ? `/set-password?code=${code}` : `/home?code=${code}`;
    return NextResponse.redirect(`${origin}${destination}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
