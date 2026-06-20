import { NextResponse } from "next/server";
import { readTotals } from "@/lib/usageTracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const totals = await readTotals();
  return NextResponse.json(totals);
}
