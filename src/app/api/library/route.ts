import { NextRequest, NextResponse } from "next/server";
import { getEntrySummaries, getAllVisibleEntries, getSeriesChapters, addEntry } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";
import { supabase } from "@/lib/supabase";
import { markScriptDone, type StageSpan } from "@/lib/perfMetrics";
import type { ScriptBlock, StoryScene } from "@/types";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { MoralLesson } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });

  const childId = req.nextUrl.searchParams.get("childId") ?? undefined;
  const scope = req.nextUrl.searchParams.get("scope");
  const seriesId = req.nextUrl.searchParams.get("seriesId");
  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 100;
  // Opt-in only — My Stories is the one view that wants an unproduced but
  // saved script to show up as a Draft; every other caller of this route
  // (Home rails, recently-played, etc.) still wants fully-saved stories only.
  const includeDrafts = req.nextUrl.searchParams.get("includeDrafts") === "1";
  // Chapter list for a story detail page — all siblings sharing seriesId.
  if (seriesId) {
    return NextResponse.json(await getSeriesChapters(seriesId, ctx.familyId));
  }
  // List views never read blocks/scenes/profiles — don't ship every story's
  // full script (or pay the extra view/share-count queries) on each render.
  if (scope === "all") {
    return NextResponse.json(await getAllVisibleEntries(ctx.familyId, { limit }));
  }
  return NextResponse.json(await getEntrySummaries(ctx.familyId, { childId, limit, includeDrafts }));
}

// POST — create a draft story row the moment a script is generated in Studio,
// before audio exists. Previously a freshly-generated script lived only in
// the browser's localStorage until "Produce" ran, so a crash, a cleared
// cache, or a different browser/device meant losing it outright, and the
// "Saved Versions" history had nothing real to attach to. Producing audio
// later reuses this same id and upserts it without isDraft, which promotes
// it to a real, visible library entry.
export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    summary?: string;
    blocks: ScriptBlock[];
    language?: string;
    scenes?: StoryScene[];
    characterProfiles?: Record<string, CharacterProfile>;
    moralLessons?: MoralLesson[];
    childIds?: string[];
    scriptGenerationMs?: number;
    // The post-generation review rounds' own timings (policy check + the
    // content/grammar/Hebrew passes inside validate-blocks) — see the
    // matching comment on markScriptDone in perfMetrics.ts.
    validationStages?: Record<string, StageSpan>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
    return NextResponse.json({ error: "blocks required" }, { status: 400 });
  }

  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });

  const id = crypto.randomUUID();
  await addEntry({
    id,
    title: body.title ?? "",
    summary: body.summary ?? "",
    durationSeconds: 0,
    createdAt: Date.now(),
    blocks: body.blocks,
    language: body.language,
    scenes: body.scenes,
    characterProfiles: body.characterProfiles,
    moralLessons: body.moralLessons,
    childIds: body.childIds,
    isDraft: true,
  }, ctx.familyId);

  // Records the "script done" stage in production_metrics right away, well
  // before Produce Audio (which may never run). See ProductionTimer.flush in
  // perfMetrics.ts for how the row gets completed. Awaited (not fire-and-
  // forget) — an un-awaited promise racing this response's return can be
  // silently killed on some hosts, same fix already applied to
  // recordScriptRevision in revise-script/route.ts. markScriptDone never
  // throws, so this can't turn a real save failure into a 500.
  await markScriptDone(supabase, {
    storyId: id,
    storyTitle: body.title,
    language: body.language,
    dialogueCount: body.blocks.filter((b) => b.characterName !== "SFX").length,
    sfxCount: body.blocks.filter((b) => b.characterName === "SFX").length,
    scriptGenerationMs: body.scriptGenerationMs,
    validationStages: body.validationStages,
  });

  return NextResponse.json({ id });
}
