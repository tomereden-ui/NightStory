import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Serves a cached avatar from Supabase storage only — no on-demand generation.
// Avatars are generated once by the browser-side seeder (/api/admin/seed-avatars).
export async function GET(
  _req: NextRequest,
  { params }: { params: { voiceId: string } },
) {
  const { voiceId } = params;
  await ensureBuckets();
  const storageKey = `${voiceId}.jpg`;

  const { data: existing } = await supabase.storage.from("voice-avatars").list("", { search: storageKey });
  if (existing?.some((f) => f.name === storageKey)) {
    const publicUrl = supabase.storage.from("voice-avatars").getPublicUrl(storageKey).data.publicUrl;
    return NextResponse.redirect(publicUrl);
  }

  return NextResponse.json({ error: "Not generated yet" }, { status: 404 });
}
