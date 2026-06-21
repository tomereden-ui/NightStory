import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { SYSTEM_AVATARS } from "@/config/systemAvatars";

export const dynamic = "force-dynamic";

const BUCKET = "voice-avatars";
const FOLDER = "system";

// GET — returns which portrait avatars are missing vs already cached
export async function GET() {
  await ensureBuckets();

  const { data: existingFiles } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 200 });
  const existingNames = new Set((existingFiles ?? []).map((f) => f.name));

  // Only avatars with prompts need AI seeding
  const seedable = SYSTEM_AVATARS.filter((a) => !!a.prompt);

  const missing = seedable
    .filter((a) => !existingNames.has(`${a.id}.jpg`))
    .map((a) => ({ id: a.id, prompt: a.prompt! }));

  const existingUrls: Record<string, string> = {};
  for (const a of seedable) {
    if (existingNames.has(`${a.id}.jpg`)) {
      existingUrls[a.id] = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${FOLDER}/${a.id}.jpg`).data.publicUrl;
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
    .from(BUCKET)
    .upload(`${FOLDER}/${avatarId}.jpg`, buf, { contentType: mimeType, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publicUrl = supabase.storage
    .from(BUCKET)
    .getPublicUrl(`${FOLDER}/${avatarId}.jpg`).data.publicUrl;

  return NextResponse.json({ ok: true, url: publicUrl });
}
