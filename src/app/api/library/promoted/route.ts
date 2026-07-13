import { NextResponse } from "next/server";
import { getPromotedEntry } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

// Not family-scoped on purpose — the promoted story is meant to be featured
// for every signed-in family, the same way classics are globally readable.
// (Still requires a session: the global /api/* middleware gates this route
// like any other, it's just not filtered by family_id ownership.)
export async function GET() {
  const entry = await getPromotedEntry();
  return NextResponse.json(entry ?? null);
}
