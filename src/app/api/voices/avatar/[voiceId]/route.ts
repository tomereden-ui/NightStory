import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { generateVoiceAvatar } from "@/lib/services/voiceAvatarService";
import { VOICE_AVATAR_PROMPTS } from "@/config/voiceAvatars";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { voiceId: string } },
) {
  const { voiceId } = params;
  const personDesc = VOICE_AVATAR_PROMPTS[voiceId];
  if (!personDesc) return NextResponse.json({ error: "Unknown voice" }, { status: 404 });

  await ensureBuckets();
  const storageKey = `${voiceId}.jpg`;

  // Already generated — just redirect to the cached image.
  const { data: existing } = await supabase.storage.from("voice-avatars").list("", { search: storageKey });
  if (existing?.some((f) => f.name === storageKey)) {
    const publicUrl = supabase.storage.from("voice-avatars").getPublicUrl(storageKey).data.publicUrl;
    return NextResponse.redirect(publicUrl);
  }

  const result = await generateVoiceAvatar(personDesc);
  if (!result) return NextResponse.json({ error: "Avatar generation failed" }, { status: 502 });

  const { error: uploadErr } = await supabase.storage
    .from("voice-avatars")
    .upload(storageKey, result.buf, { contentType: result.mimeType, upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const publicUrl = supabase.storage.from("voice-avatars").getPublicUrl(storageKey).data.publicUrl;
  return NextResponse.redirect(publicUrl);
}
