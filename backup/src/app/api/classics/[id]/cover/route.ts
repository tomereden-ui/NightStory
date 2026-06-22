import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CLASSIC_STORIES } from "@/lib/classicStories";
import { fetchPollinationsImage } from "@/lib/services/pollinationsClient";

export const dynamic = "force-dynamic";

const BUCKET = "classics";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const def = CLASSIC_STORIES.find((s) => s.id === id);
  if (!def) return NextResponse.json({ error: "Unknown classic id" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type || "image/jpeg";
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const path = `${id}/cover.${ext}`;

  const bytes = await file.arrayBuffer();
  const blob = new Blob([bytes], { type: mimeType });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: mimeType });

  if (error) {
    console.error("[Classics] Cover upload error:", error.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const coverUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  return NextResponse.json({ ok: true, coverUrl });
}

// PUT — regenerate cover from the story's AI prompt via Pollinations
export async function PUT(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const def = CLASSIC_STORIES.find((s) => s.id === id);
  if (!def) return NextResponse.json({ error: "Unknown classic id" }, { status: 404 });

  let result: Awaited<ReturnType<typeof fetchPollinationsImage>>;
  try {
    result = await fetchPollinationsImage(def.coverPrompt, `Classic-${id}`, { width: 768, height: 768 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  if (!result) return NextResponse.json({ error: "Image generation returned nothing" }, { status: 502 });

  const path = `${id}/cover.jpg`;
  const blob = new Blob([result.buf.buffer as ArrayBuffer], { type: "image/jpeg" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const coverUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}?t=${Date.now()}`;
  return NextResponse.json({ ok: true, coverUrl });
}
