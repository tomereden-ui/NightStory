import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import fs from "fs";
import os from "os";
import path from "path";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  let body: {
    name?: string;
    avatarEmoji?: string;
    presetKey?: string;
    voiceSettings?: object;
    elVoiceId?: string;
    versions?: object[];
    audioBase64?: string;
    mimeType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.avatarEmoji !== undefined) updates.avatar_emoji = body.avatarEmoji;
  if (body.presetKey !== undefined) updates.preset_key = body.presetKey;
  if (body.voiceSettings !== undefined) updates.voice_settings = body.voiceSettings;
  if (body.elVoiceId !== undefined) updates.el_voice_id = body.elVoiceId;
  if (body.versions !== undefined) updates.versions = body.versions;

  // For re-record: upload new audio sample, overwriting the existing one
  if (body.audioBase64) {
    const tmpPath = path.join(os.tmpdir(), `voice-patch-${id}.tmp`);
    try {
      await ensureBuckets();
      const ext = body.mimeType?.includes("mp3") || body.mimeType?.includes("mpeg") ? "mp3" : "wav";
      const storagePath = `voices/${id}.${ext}`;
      const audioBuffer = Buffer.from(body.audioBase64, "base64");
      fs.writeFileSync(tmpPath, audioBuffer);

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(storagePath, audioBuffer, {
          contentType: body.mimeType ?? "audio/wav",
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("audio").getPublicUrl(storagePath);
        updates.sample_url = urlData.publicUrl ?? null;
      } else {
        console.warn("[voices PATCH] Storage upload error:", uploadError.message);
      }
    } catch (err) {
      console.warn("[voices PATCH] Storage error:", err);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await supabase
    .from("voices")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const { error } = await supabase.from("voices").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
