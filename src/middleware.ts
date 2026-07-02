import { NextRequest, NextResponse } from "next/server";

// API routes that are intentionally public (no login required)
const PUBLIC_API_PREFIXES = [
  "/api/auth/",       // OAuth callback
  "/api/classics",    // Public classic story catalogue
  "/api/community",   // Public community feed
  "/api/story/",      // Public story share view
];

/**
 * Decode a JWT payload without verifying the signature.
 * We check sub + exp + iss as a fast first-pass gate that stops completely
 * unauthenticated requests. The Supabase service-role client in each route
 * provides the real security boundary for data access.
 */
function decodeJwt(token: string): { sub?: string; exp?: number; iss?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Read the access token from the ns-session cookie set by AuthContext
 * whenever the Supabase session changes. This is the bridge between
 * localStorage-based Supabase sessions and server-readable cookies.
 */
function getAccessTokenFromCookies(req: NextRequest): string | null {
  return req.cookies.get("ns-session")?.value ?? null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Let explicitly public routes through
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Accept token from Authorization header (used by /api/account/delete etc.)
  // or from the ns-session cookie set by AuthContext on session change
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = getAccessTokenFromCookies(req);
  const accessToken = bearerToken ?? cookieToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Decode and do a fast local validity check (expiry + issuer).
  // Cryptographic signature verification happens inside Supabase for any
  // actual data operation; this layer stops fully anonymous requests.
  const payload = decodeJwt(accessToken);
  const nowSec = Math.floor(Date.now() / 1000);

  if (!payload?.sub || (payload.exp !== undefined && payload.exp < nowSec)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: confirm token was issued by our Supabase project
  if (supabaseUrl && payload.iss && !payload.iss.startsWith(supabaseUrl)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next({ request: req });
}

export const config = {
  matcher: ["/api/:path*"],
};
