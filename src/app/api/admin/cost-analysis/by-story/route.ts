import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Per-story cost breakdown — real, from service_usage (not the estimate
// /api/admin/cost-analysis/library derives from block/duration counts after
// the fact). Sorted most expensive first so the biggest cost drivers are
// immediately visible.
export async function GET() {
  const { data: usageRows, error } = await supabase
    .from("service_usage")
    .select("story_id, call_type, cost_usd")
    .not("story_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20000);

  if (error) {
    return NextResponse.json({ stories: [], error: error.message, tableReady: false });
  }

  const byStory = new Map<string, { costUsd: number; calls: number; byCallType: Map<string, number> }>();
  for (const r of usageRows ?? []) {
    const id = r.story_id as string;
    const existing = byStory.get(id) ?? { costUsd: 0, calls: 0, byCallType: new Map<string, number>() };
    existing.costUsd += r.cost_usd ?? 0;
    existing.calls += 1;
    existing.byCallType.set(r.call_type, (existing.byCallType.get(r.call_type) ?? 0) + (r.cost_usd ?? 0));
    byStory.set(id, existing);
  }

  const storyIds = Array.from(byStory.keys());
  const { data: storyRows } = storyIds.length
    ? await supabase.from("stories").select("id, title, language, is_draft").in("id", storyIds)
    : { data: [] as { id: string; title: string; language: string | null; is_draft: boolean }[] };
  const titleById = new Map((storyRows ?? []).map((s) => [s.id, s]));

  const stories = Array.from(byStory.entries())
    .map(([storyId, v]) => ({
      storyId,
      title: titleById.get(storyId)?.title ?? "(deleted story)",
      language: titleById.get(storyId)?.language ?? null,
      isDraft: titleById.get(storyId)?.is_draft ?? null,
      costUsd: v.costUsd,
      calls: v.calls,
      topCallTypes: Array.from(v.byCallType.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([callType, costUsd]) => ({ callType, costUsd })),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return NextResponse.json({ stories, tableReady: true });
}
