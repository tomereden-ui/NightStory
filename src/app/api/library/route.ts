import { NextResponse } from "next/server";
import { getEntries } from "@/lib/libraryStore";

export async function GET() {
  return NextResponse.json(getEntries());
}
