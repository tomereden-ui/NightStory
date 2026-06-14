import { NextResponse } from "next/server";
import { getEntries } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getEntries());
}
