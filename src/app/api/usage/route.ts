import { NextResponse } from "next/server";
import { readTotals } from "@/lib/usageTracker";

export async function GET() {
  const totals = await readTotals();
  return NextResponse.json(totals);
}
