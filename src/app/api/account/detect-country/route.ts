import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/authContext";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string | null {
  // x-forwarded-for can be a comma-separated chain (client, proxy1, proxy2…) —
  // the first entry is the original client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// Best-effort IP → country lookup, called once per browser session right
// after login (see AuthContext.tsx). Never throws in a way that could
// surface to the user — this is a nice-to-have data point, not something
// that should ever block or disrupt sign-in.
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    // Skip the lookup entirely once we already have a country for this
    // user — no point re-querying ipapi.co (rate-limited on the free tier)
    // on every single login.
    const { data: existing } = await supabase
      .from("user_profiles")
      .select("country_code")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.country_code) {
      return NextResponse.json({ ok: true, countryCode: existing.country_code, skipped: true });
    }

    const ip = clientIp(req);
    // Local/private IPs (dev, internal networks) have no geolocation —
    // ipapi.co would just error on them, so skip the network call entirely.
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return NextResponse.json({ ok: false, reason: "no-public-ip" });
    }

    const res = await fetch(`https://ipapi.co/${ip}/country/`);
    if (!res.ok) return NextResponse.json({ ok: false, reason: `ipapi ${res.status}` });
    const countryCode = (await res.text()).trim();
    // ipapi.co returns a plain-text error message (not a 2-letter code) for
    // invalid/reserved/rate-limited requests instead of a non-2xx status —
    // validate the shape rather than trusting any 200 response.
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      console.warn("[detect-country] unexpected ipapi response:", countryCode);
      return NextResponse.json({ ok: false, reason: "unexpected-response" });
    }

    await supabase
      .from("user_profiles")
      .update({ country_code: countryCode, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({ ok: true, countryCode });
  } catch (err) {
    console.warn("[detect-country] failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
