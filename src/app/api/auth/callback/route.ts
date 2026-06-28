import { NextRequest, NextResponse } from "next/server";
import { supabaseAuth } from "@/lib/supabaseAuth";

export const dynamic = "force-dynamic";

// Handles email confirmation and password-reset redirects from Supabase.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    await supabaseAuth.auth.exchangeCodeForSession(code);
    // Redirect to set-password for both invites and password resets
    return NextResponse.redirect(`${origin}/set-password`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
