import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { getCachedVoices, setCachedVoices, invalidateVoicesCache } from "@/lib/voicesCache";

// ─── GET: list all voices ─────────────────────────────────────────────────────

export async function GET() {
  const cached = getCachedVoices();
  if (cached) return NextResponse.json(cached);

  try {
    const { data, error } = await supabase
      .from("voices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[voices GET]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    setCachedVoices(data ?? []);
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[voices GET] unexpected:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── POST: create a voice ─────────────────────────────────────────────────────

interface CreateVoiceBody {
  name: string;
  category: string;
  type: string;
  description?: string;
  geminiVoiceName?: string;
  elVoiceId?: string;
  audioBase64?: string;
  mimeType?: string;
  avatarEmoji?: string;
  presetKey?: string;
  voiceSettings?: { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean };
  versions?: object[];
}

export async function POST(req: NextRequest) {
  let body: CreateVoiceBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const id = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let sampleUrl: string | null = null;

  // Upload audio sample to Supabase Storage if provided
  if (body.audioBase64) {
    try {
      await ensureBuckets();

      const ext = body.mimeType?.includes("mpeg") || body.mimeType?.includes("mp3") ? "mp3" : "wav";
      const path = `voices/${id}.${ext}`;
      const audioBuffer = Buffer.from(body.audioBase64, "base64");

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(path, audioBuffer, {
          contentType: body.mimeType ?? "audio/wav",
          upsert: false,
        });

      if (uploadError) {
        console.warn("[voices POST] Storage upload error:", uploadError.message);
      } else {
        const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
        sampleUrl = urlData.publicUrl ?? null;
      }
    } catch (err) {
      console.warn("[voices POST] Storage error:", err);
    }
  }

  const row = {
    id,
    name: body.name.trim(),
    category: body.category ?? "family",
    type: body.type ?? "text",
    description: body.description ?? null,
    gemini_voice_name: body.geminiVoiceName ?? null,
    el_voice_id: body.elVoiceId ?? null,
    sample_url: sampleUrl,
    avatar_emoji: body.avatarEmoji ?? "🎙",
    created_at: Date.now(),
    preset_key: body.presetKey ?? null,
    voice_settings: body.voiceSettings ?? null,
    versions: body.versions ?? null,
  };

  let { data, error } = await supabase.from("voices").insert(row).select().single();

  // If the new columns don't exist yet (migration not run), retry without them
  if (error && (error.message.includes("preset_key") || error.message.includes("voice_settings") || error.message.includes("versions"))) {
    console.warn("[voices POST] New columns missing — retrying without preset_key/voice_settings/versions");
    const { preset_key: _pk, voice_settings: _vs, versions: _v, ...rowWithoutNewCols } = row;
    ({ data, error } = await supabase.from("voices").insert(rowWithoutNewCols).select().single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateVoicesCache();
  return NextResponse.json(data, { status: 201 });
}
