import { NextResponse } from "next/server";
import { getCommunityEntries } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCommunityEntries());
}
