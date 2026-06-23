import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  let mimeType: string, data: string;
  try {
    ({ mimeType, data } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!mimeType || !data) return NextResponse.json({ error: "mimeType and data required" }, { status: 400 });

  const ext = mimeType.includes("png") ? "png" : "jpg";
  const storageKey = `${id}.${ext}`;

  const buf = Buffer.from(data, "base64");
  const { error: uploadErr } = await supabase.storage
    .from("covers")
    .upload(storageKey, buf, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    console.error("[cover PATCH] upload failed:", uploadErr.message);
    return NextResponse.json({ error: uploadErr.message }, { status: 502 });
  }

  const publicUrl = supabase.storage.from("covers").getPublicUrl(storageKey).data.publicUrl;

  const { error: dbErr } = await supabase
    .from("stories")
    .update({ cover_url: publicUrl })
    .eq("id", id);

  if (dbErr) {
    console.error("[cover PATCH] db update failed:", dbErr.message);
    return NextResponse.json({ error: dbErr.message }, { status: 502 });
  }

  return NextResponse.json({ coverUrl: publicUrl });
}
