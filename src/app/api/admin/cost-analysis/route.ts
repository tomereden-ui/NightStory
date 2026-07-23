import { NextResponse } from "next/server";
import { readTotals } from "@/lib/usageTracker";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface UsageRow {
  story_id: string | null;
  provider: string;
  model: string;
  call_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  characters: number | null;
  audio_seconds: number | null;
  cost_usd: number;
}

// Real, accurate cost — aggregated from service_usage (one row per API call,
// see src/lib/serviceUsage.ts), replacing the old cumulative-blob totals
// (still returned below as `totals` for backward compat with existing UI,
// but `accurate` is the trustworthy figure: per-model, per-call-type,
// no read-modify-write race, and includes every provider/model this app
// actually calls).
export async function GET() {
  const [totals, { data: stories }, { data: usageRows, error: usageError }] = await Promise.all([
    readTotals(),
    supabase.from("stories").select("duration_seconds, is_public"),
    supabase
      .from("service_usage")
      .select("story_id, provider, model, call_type, input_tokens, output_tokens, characters, audio_seconds, cost_usd")
      .order("created_at", { ascending: false })
      .limit(20000) as unknown as Promise<{ data: UsageRow[] | null; error: { message: string } | null }>,
  ]);

  const all = stories ?? [];
  const totalDurationSec = all.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);

  const rows = usageRows ?? [];
  const grandTotalUsd = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const distinctStoryIds = new Set(rows.map((r) => r.story_id).filter(Boolean));

  // Group by call_type (the meaningful "what step of the pipeline" axis) —
  // provider/model shown as the sub-label since a call_type is always one
  // consistent provider+model pair in practice.
  const byCallType = new Map<string, { provider: string; model: string; calls: number; costUsd: number; inputTokens: number; outputTokens: number; characters: number; audioSeconds: number }>();
  for (const r of rows) {
    const key = r.call_type;
    const existing = byCallType.get(key) ?? { provider: r.provider, model: r.model, calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, characters: 0, audioSeconds: 0 };
    existing.calls += 1;
    existing.costUsd += r.cost_usd ?? 0;
    existing.inputTokens += r.input_tokens ?? 0;
    existing.outputTokens += r.output_tokens ?? 0;
    existing.characters += r.characters ?? 0;
    existing.audioSeconds += r.audio_seconds ?? 0;
    byCallType.set(key, existing);
  }
  const callTypeBreakdown = Array.from(byCallType.entries())
    .map(([callType, v]) => ({ callType, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd);

  // Group by provider (top-level split, e.g. for a Gemini-vs-ElevenLabs pie)
  const byProvider = new Map<string, { calls: number; costUsd: number }>();
  for (const r of rows) {
    const existing = byProvider.get(r.provider) ?? { calls: 0, costUsd: 0 };
    existing.calls += 1;
    existing.costUsd += r.cost_usd ?? 0;
    byProvider.set(r.provider, existing);
  }
  const providerBreakdown = Array.from(byProvider.entries()).map(([provider, v]) => ({ provider, ...v }));

  return NextResponse.json({
    totals,
    storyCount: all.length,
    publicCount: all.filter((r) => r.is_public).length,
    privateCount: all.filter((r) => !r.is_public).length,
    totalDurationSec,
    accurate: {
      grandTotalUsd,
      rowCount: rows.length,
      storiesWithUsage: distinctStoryIds.size,
      callTypeBreakdown,
      providerBreakdown,
      // Signals whether the migration has actually been run yet, so the UI
      // can show a clear "run this migration" hint instead of a silent $0.
      tableReady: !usageError,
      error: usageError?.message,
    },
  });
}
