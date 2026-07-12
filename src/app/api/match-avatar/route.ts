import { NextRequest, NextResponse } from "next/server";
import { findBestAvatarForCharacter } from "@/lib/services/avatarBankService";

// Thin wrapper around findBestAvatarForCharacter for the Studio cast sheet's
// per-character "Auto Assign" avatar button — the same AI profile-matching
// logic produce-drama runs automatically for every character at generation
// time, exposed here so a single character's avatar can be re-matched later
// (e.g. after a manual voice/type change) without reproducing the whole story.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let profile: { type?: string; gender?: string; ageBucket?: string; category?: string; visualDescription?: string } | undefined;
  let excludeUrls: string[] | undefined;
  try {
    ({ profile, excludeUrls } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!profile?.type) return NextResponse.json({ error: "profile.type is required" }, { status: 400 });

  const avatarUrl = await findBestAvatarForCharacter(
    profile as { type: string; gender?: string; ageBucket?: string; category?: string; visualDescription?: string },
    apiKey,
    excludeUrls?.length ? new Set(excludeUrls) : undefined,
  );
  return NextResponse.json({ avatarUrl });
}
