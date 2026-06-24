/**
 * POST /api/avatar
 * Body: { description: string }
 * Returns: { avatarUrl: string | null }
 *
 * Finds the closest avatar from the pre-seeded bank using embedding similarity.
 * Used by ChildProfilePicker and any other client-side code that needs an avatar URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { findBestAvatar } from "@/lib/services/avatarBankService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let description: string;
  try {
    ({ description } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });

  const avatarUrl = await findBestAvatar(description.trim(), apiKey);
  return NextResponse.json({ avatarUrl });
}
