import { NextRequest, NextResponse } from "next/server";
import { supabaseAuth } from "@/lib/supabaseAuth";

export const dynamic = "force-dynamic";

// Handles email confirmation and password-reset redirects from Supabase.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    // Pass the code to the client-side set-password page to exchange there,
    // so the session is stored in the browser (not just server memory).
    return NextResponse.redirect(`${origin}/set-password?code=${code}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
