import { NextResponse } from "next/server";
import { readTotals } from "@/lib/usageTracker";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const [totals, { data: stories }] = await Promise.all([
    readTotals(),
    supabase.from("stories").select("duration_seconds, is_public"),
  ]);

  const all = stories ?? [];
  const totalDurationSec = all.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);

  return NextResponse.json({
    totals,
    storyCount: all.length,
    publicCount: all.filter((r) => r.is_public).length,
    privateCount: all.filter((r) => !r.is_public).length,
    totalDurationSec,
  });
}
