import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { SYSTEM_AVATARS } from "@/config/systemAvatars";

export const dynamic = "force-dynamic";

// GET — returns which system avatars are missing and which are already cached
export async function GET() {
  await ensureBuckets();
  const { data: existingFiles } = await supabase.storage
    .from("voice-avatars")
    .list("system", { limit: 200 });
  const existingNames = new Set((existingFiles ?? []).map((f) => f.name));

  const missing = SYSTEM_AVATARS.filter((a) => !existingNames.has(`${a.id}.jpg`)).map((a) => ({
    id: a.id,
    prompt: a.prompt,
  }));

  const existingUrls: Record<string, string> = {};
  for (const a of SYSTEM_AVATARS) {
    if (existingNames.has(`${a.id}.jpg`)) {
      existingUrls[a.id] = supabase.storage
        .from("voice-avatars")
        .getPublicUrl(`system/${a.id}.jpg`).data.publicUrl;
    }
  }

  return NextResponse.json({ missing, existingUrls });
}

// POST — browser sends generated image blob; server stores in Supabase
export async function POST(req: NextRequest) {
  const avatarId = req.nextUrl.searchParams.get("avatarId");
  if (!avatarId) return NextResponse.json({ error: "Missing avatarId" }, { status: 400 });

  await ensureBuckets();
  const blob = await req.blob();
  const buf = Buffer.from(await blob.arrayBuffer());
  const mimeType = blob.type || "image/jpeg";

  const { error } = await supabase.storage
    .from("voice-avatars")
    .upload(`system/${avatarId}.jpg`, buf, { contentType: mimeType, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publicUrl = supabase.storage
    .from("voice-avatars")
    .getPublicUrl(`system/${avatarId}.jpg`).data.publicUrl;

  return NextResponse.json({ ok: true, url: publicUrl });
}
