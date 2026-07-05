import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TABLE = "listening_progress";

export async function GET(req: NextRequest) {
  const storyId = req.nextUrl.searchParams.get("storyId");
  const childId = req.nextUrl.searchParams.get("childId");
  if (!storyId || !childId) {
    return NextResponse.json({ error: "storyId and childId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("position_seconds, duration_seconds, completed, play_count")
    .eq("story_id", storyId)
    .eq("child_profile_id", childId)
    .maybeSingle();

  // Tolerant — table may not exist yet if the migration hasn't been run;
  // treat that the same as "no saved progress" rather than erroring the page.
  if (error || !data) return NextResponse.json(null);

  return NextResponse.json({
    positionSeconds: data.position_seconds,
    durationSeconds: data.duration_seconds,
    completed: data.completed,
    playCount: data.play_count,
  });
}

export async function PATCH(req: NextRequest) {
  let body: {
    storyId?: string; childId?: string;
    positionSeconds?: number; durationSeconds?: number; completed?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, childId, positionSeconds, durationSeconds } = body;
  if (!storyId || !childId || typeof positionSeconds !== "number") {
    return NextResponse.json({ error: "storyId, childId, positionSeconds required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from(TABLE)
    .select("completed, play_count")
    .eq("story_id", storyId)
    .eq("child_profile_id", childId)
    .maybeSingle();

  // Position only grows during playback, so a small position on a story that
  // was previously marked completed means the child genuinely restarted it —
  // not just an early tick on first-ever playback.
  const isFreshReplay = (existing?.completed ?? false) && positionSeconds < 5;

  const { error } = await supabase.from(TABLE).upsert({
    story_id: storyId,
    child_profile_id: childId,
    position_seconds: positionSeconds,
    duration_seconds: durationSeconds ?? null,
    completed: body.completed ?? false,
    play_count: isFreshReplay ? (existing?.play_count ?? 1) + 1 : (existing?.play_count ?? 1),
    last_played_at: new Date().toISOString(),
  }, { onConflict: "story_id,child_profile_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
