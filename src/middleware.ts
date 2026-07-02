import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// API routes that are intentionally public (no login required)
const PUBLIC_API_PREFIXES = [
  "/api/auth/",       // OAuth callback
  "/api/classics",    // Public classic story catalogue
  "/api/community",   // Public community feed
  "/api/story/",      // Public story share view
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Let explicitly public routes through without a token check
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagate any refreshed session cookies to both the request (for
          // downstream handlers) and the response (back to the browser).
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase; it also silently refreshes
  // an expired session and writes the new tokens via setAll above.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
