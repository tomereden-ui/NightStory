import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { channel } = (await req.json().catch(() => ({}))) as { channel?: string };
  if (!channel) return NextResponse.json({ error: "channel required" }, { status: 400 });

  await supabase.from("story_shares").insert({
    story_id: params.id,
    channel,
    shared_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
