import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { supabase } from "./supabase";

// Resolves "who is calling and which family do they belong to" for API routes.
//
// The middleware only checks that *some* structurally-valid, unexpired JWT is
// present — it cannot verify signatures on the Edge runtime without the secret.
// Routes that serve family-scoped data must therefore resolve the family here
// and filter every query by it. Even with an unverified token, an attacker
// would need a real user's UUID for the family lookup to resolve to anything.
//
// For full signature verification, set SUPABASE_JWT_SECRET in .env.local
// (Supabase dashboard → Settings → API → JWT Secret). When present, tokens
// with bad signatures are rejected outright.

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function verifySignature(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = b64urlDecode(parts[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function getUserIdFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearer ?? req.cookies.get("ns-session")?.value ?? null;
  if (!token) {
    console.warn(`[authContext] ${req.method} ${req.nextUrl.pathname} — no bearer header and no ns-session cookie`);
    return null;
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret && !verifySignature(token, secret)) {
    console.warn(`[authContext] ${req.method} ${req.nextUrl.pathname} — token present but signature verification failed`);
    return null;
  }

  try {
    const payload = JSON.parse(b64urlDecode(token.split(".")[1]).toString()) as {
      sub?: string;
      exp?: number;
    };
    if (!payload.sub) {
      console.warn(`[authContext] ${req.method} ${req.nextUrl.pathname} — token has no sub claim`);
      return null;
    }
    if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn(`[authContext] ${req.method} ${req.nextUrl.pathname} — token expired at ${new Date(payload.exp * 1000).toISOString()} (now ${new Date().toISOString()})`);
      return null;
    }
    return payload.sub;
  } catch (err) {
    console.warn(`[authContext] ${req.method} ${req.nextUrl.pathname} — failed to parse token payload:`, err);
    return null;
  }
}

// user → family lookups are hot (every data request) and change only when a
// user joins/leaves a family, so cache them in-process for a few minutes.
const FAMILY_CACHE_TTL_MS = 5 * 60_000;
const familyCache = new Map<string, { familyId: string | null; at: number }>();

export function invalidateFamilyCache(userId?: string): void {
  if (userId) familyCache.delete(userId);
  else familyCache.clear();
}

export async function getFamilyIdForUser(userId: string): Promise<string | null> {
  const cached = familyCache.get(userId);
  if (cached && Date.now() - cached.at < FAMILY_CACHE_TTL_MS) {
    console.log(`[authContext] getFamilyIdForUser(${userId}) — cache hit: familyId=${cached.familyId} (age ${Math.round((Date.now() - cached.at) / 1000)}s)`);
    return cached.familyId;
  }

  const { data, error } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getFamilyIdForUser: ${error.message}`);

  const familyId = (data?.family_id as string | undefined) ?? null;
  console.log(`[authContext] getFamilyIdForUser(${userId}) — DB lookup: familyId=${familyId}`);
  familyCache.set(userId, { familyId, at: Date.now() });
  return familyId;
}

export interface FamilyContext {
  userId: string;
  familyId: string;
}

/** Resolve the caller's family, or null when unauthenticated / not in a family. */
export async function getFamilyContext(req: NextRequest): Promise<FamilyContext | null> {
  const userId = getUserIdFromRequest(req);
  if (!userId) return null;
  const familyId = await getFamilyIdForUser(userId);
  if (!familyId) return null;
  return { userId, familyId };
}
