import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface PublicStoryData {
  id: string;
  title: string;
  summary: string;
  audioUrl: string;
  coverUrl: string | null;
  durationSeconds: number;
  shareMessage: string | null;
  children: { id: string; name: string; avatarEmoji: string }[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { data: story, error } = await supabase
    .from("stories")
    .select("id, title, summary, audio_url, cover_url, duration_seconds, share_message, child_ids")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!story || !story.audio_url) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    children,
  };

  // Log view (fire-and-forget, don't delay the response)
  supabase.from("story_views").insert({ story_id: params.id, viewed_at: new Date().toISOString() }).then(() => {});

  return NextResponse.json(result);
}
