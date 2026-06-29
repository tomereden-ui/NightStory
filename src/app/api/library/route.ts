import { NextRequest, NextResponse } from "next/server";
import { getEntries } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId") ?? undefined;
  return NextResponse.json(await getEntries(childId));
}
