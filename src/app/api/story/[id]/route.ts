import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getFamilyContext } from "@/lib/authContext";

export const dynamic = "force-dynamic";

export interface PublicStoryData {
  id: string;
  title: string;
  summary: string;
  audioUrl: string;
  coverUrl: string | null;
  durationSeconds: number;
  shareMessage: string | null;
  language: string;
  isOwner: boolean;
  coverFocusX: number | null;
  coverFocusY: number | null;
  children: { id: string; name: string; avatarEmoji: string }[];
}

const BASE_COLUMNS = "id, title, summary, audio_url, cover_url, duration_seconds, share_message, child_ids, language, family_id";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let { data: story, error } = await supabase
    .from("stories")
    .select(`${BASE_COLUMNS}, cover_focus_x, cover_focus_y`)
    .eq("id", params.id)
    .maybeSingle();
  // cover_focus_x/y don't exist until that migration runs — retry without
  // them rather than 500ing this public page for every visitor.
  if (error && /cover_focus/.test(error.message)) {
    ({ data: story, error } = await supabase.from("stories").select(BASE_COLUMNS).eq("id", params.id).maybeSingle());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!story || !story.audio_url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Anonymous by default (this route is fully public, no login required) —
  // only resolves to true when the visitor happens to be signed in as a
  // member of the family that owns this story, which is what unlocks the
  // "edit the intro line" UI client-side. getFamilyContext returns null
  // for an unauthenticated request rather than throwing.
  const ctx = await getFamilyContext(req);
  const isOwner = !!ctx && !!story.family_id && ctx.familyId === story.family_id;

  const childIds: string[] = Array.isArray(story.child_ids) ? story.child_ids : [];
  let children: PublicStoryData["children"] = [];

  if (childIds.length > 0) {
    const { data: profiles } = await supabase
      .from("child_profiles")
      .select("id, name, avatar_emoji")
      .in("id", childIds);
    children = (profiles ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      avatarEmoji: (p.avatar_emoji as string) || "🧒",
    }));
  }

  const result: PublicStoryData = {
    id: story.id as string,
    title: story.title as string,
    summary: (story.summary as string) ?? "",
    audioUrl: story.audio_url as string,
    coverUrl: (story.cover_url as string) ?? null,
    durationSeconds: (story.duration_seconds as number) ?? 0,
    shareMessage: (story.share_message as string) ?? null,
    language: (story.language as string) ?? "en",
    isOwner,
    coverFocusX: typeof story.cover_focus_x === "number" ? story.cover_focus_x : null,
    coverFocusY: typeof story.cover_focus_y === "number" ? story.cover_focus_y : null,
    children,
  };

  // Log view (fire-and-forget, don't delay the response)
  supabase.from("story_views").insert({ story_id: params.id, viewed_at: new Date().toISOString() }).then(() => {});

  return NextResponse.json(result);
}
