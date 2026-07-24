import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAIL = "tomereden@gmail.com";

// API routes that are intentionally public (no login required)
const PUBLIC_API_PREFIXES = [
  "/api/auth/",       // OAuth callback
  "/api/classics",    // Public classic story catalogue
  "/api/community",   // Public community feed
  "/api/story/",      // Public story share view
];

// Exact API paths reachable only by the admin account. Pure internal tooling
// (bulk story maintenance, cost dashboards, the Voice Manager audition tool)
// — never called by any regular user-facing flow. Several other routes live
// under /api/admin/ for organizational reasons only (seed-avatars,
// seed-scene-characters, seed-create-images, seed-bluebell-audio, and
// tts-engine-settings' GET) but are genuinely called by ordinary families
// during real story creation, so they're deliberately NOT in this list —
// locking them down here would break story creation for everyone.
const ADMIN_ONLY_PATHS = new Set([
  "/api/admin/seed-system-avatars",
  "/api/admin/test-imagen",
  "/api/admin/seed-avatar-bank",
  "/api/admin/migrate-classics-to-db",
  "/api/admin/backfill-avatar-ages",
  "/api/admin/backfill-story-durations",
  "/api/admin/suggest-sfx",
  "/api/admin/seed-sfx-library",
  "/api/admin/list-all-stories",
  "/api/admin/assign-to-series",
  "/api/admin/analyze-values",
  "/api/admin/backfill-character-profiles",
  "/api/admin/delete-audio",
  "/api/admin/generate-voice-samples",
  "/api/admin/promote-story",
  "/api/admin/reassign-avatars",
  "/api/admin/reassign-voices",
  "/api/admin/refresh-story",
  "/api/admin/regenerate-scenes",
  "/api/admin/regenerate-summary",
  "/api/admin/save-story",
  "/api/admin/story-meta",
  "/api/admin/mark-script-done",
  "/api/admin/cost-analysis",
  "/api/admin/cost-analysis/by-story",
  "/api/admin/cost-analysis/library",
  "/api/voice-manager/chirp-voices",
  "/api/voice-manager/synthesize",
]);

// tts-engine-settings' GET is read by every family's voice-assignment flow
// (voiceCatalog.ts's fetchVoicePool) — only its POST (which actually changes
// production TTS engine settings) is admin-only.
const ADMIN_ONLY_POST_PATHS = new Set(["/api/admin/tts-engine-settings"]);

// Page routes that should never even render for a non-admin session — the
// client-side "Admin access only" lock screen in these pages is cosmetic,
// this is the real boundary.
const ADMIN_PAGE_PATHS = ["/admin", "/voice_manager"];

/**
 * Decode a JWT payload without verifying the signature.
 * We check sub + exp + iss as a fast first-pass gate that stops completely
 * unauthenticated requests. The Supabase service-role client in each route
 * provides the real security boundary for data access.
 */
function decodeJwt(token: string): { sub?: string; exp?: number; iss?: string; email?: string } | null {
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

  const isAdminPage = ADMIN_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");

  // Only gate API routes and the admin-only page routes
  if (!isApi && !isAdminPage) return NextResponse.next();

  // Let explicitly public API routes through
  if (isApi && PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Accept token from Authorization header (used by /api/account/delete etc.)
  // or from the ns-session cookie set by AuthContext on session change
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = getAccessTokenFromCookies(req);
  const accessToken = bearerToken ?? cookieToken;

  // Page routes fail closed with a redirect (no JSON body to show); API
  // routes fail closed with a JSON error response.
  const deny = (status: 401 | 403) =>
    isAdminPage
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.json({ error: status === 403 ? "Forbidden — admin only." : "Unauthorized" }, { status });

  if (!accessToken) return deny(401);

  // Decode and do a fast local validity check (expiry + issuer).
  // Cryptographic signature verification happens inside Supabase for any
  // actual data operation; this layer stops fully anonymous requests.
  const payload = decodeJwt(accessToken);
  const nowSec = Math.floor(Date.now() / 1000);

  if (!payload?.sub || (payload.exp !== undefined && payload.exp < nowSec)) {
    return deny(401);
  }

  // Optional: confirm token was issued by our Supabase project
  if (supabaseUrl && payload.iss && !payload.iss.startsWith(supabaseUrl)) {
    return deny(401);
  }

  // Admin-only surfaces (the /admin and /voice_manager pages, plus the exact
  // internal-tooling API paths above) additionally require the admin email —
  // any other logged-in family is a valid session but must not reach these.
  const requiresAdmin =
    isAdminPage ||
    ADMIN_ONLY_PATHS.has(pathname) ||
    (ADMIN_ONLY_POST_PATHS.has(pathname) && req.method === "POST");

  if (requiresAdmin && payload.email !== ADMIN_EMAIL) {
    return deny(403);
  }

  return NextResponse.next({ request: req });
}

export const config = {
  matcher: ["/api/:path*", "/admin", "/admin/:path*", "/voice_manager", "/voice_manager/:path*"],
};
