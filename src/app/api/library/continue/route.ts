import { NextRequest, NextResponse } from "next/server";
import { getContinueListening } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";

export const dynamic = "force-dynamic";

// Real "resume where you left off" rail for the home screen, driven by
// listening_progress — chapter-level (a specific story row, not a series).
export async function GET(req: NextRequest) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });

  const childId = req.nextUrl.searchParams.get("childId");
  if (!childId) return NextResponse.json([]);

  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 6;

  return NextResponse.json(await getContinueListening(childId, ctx.familyId, limit));
}
