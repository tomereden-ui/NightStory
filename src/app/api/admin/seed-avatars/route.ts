import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { PRESET_VOICES } from "@/config/presetVoices";
import { VOICE_AVATAR_PROMPTS } from "@/config/voiceAvatars";

export const dynamic = "force-dynamic";

// GET — returns which avatars are missing and which already exist in Supabase
export async function GET() {
  await ensureBuckets();
  const { data: existingFiles } = await supabase.storage.from("voice-avatars").list("", { limit: 100 });
  const existingNames = new Set((existingFiles ?? []).map((f) => f.name));

  const missing = PRESET_VOICES
    .filter((v) => !existingNames.has(`${v.id}.jpg`))
    .map((v) => ({ id: v.id, prompt: VOICE_AVATAR_PROMPTS[v.id] ?? "" }));

  const existing = PRESET_VOICES
    .filter((v) => existingNames.has(`${v.id}.jpg`))
    .map((v) => v.id);

  return NextResponse.json({ missing, existing });
}

// POST — browser sends a generated image blob; server caches it in Supabase
export async function POST(req: NextRequest) {
  const voiceId = req.nextUrl.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "Missing voiceId" }, { status: 400 });

  await ensureBuckets();
  const blob = await req.blob();
  const buf = Buffer.from(await blob.arrayBuffer());
  const mimeType = blob.type || "image/jpeg";

  const { error } = await supabase.storage
    .from("voice-avatars")
    .upload(`${voiceId}.jpg`, buf, { contentType: mimeType, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
