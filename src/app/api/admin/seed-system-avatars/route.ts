import { NextResponse } from "next/server";

// System avatars now use DiceBear SVG URLs (no seeding needed)
export async function GET() {
  return NextResponse.json({ ok: true, message: "System avatars use DiceBear — no seeding required." });
}
