import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAllCreateOptionSpecs, optionStorageKey } from "@/config/createFlowImages";

export const dynamic = "force-dynamic";

const BUCKET = "story-options";

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[seed-create-images] bucket:", error.message);
  }
}

export async function GET() {
  await ensureBucket();
  const { data: existingFiles } = await supabase.storage.from(BUCKET).list("", { limit: 100 });
  const existingNames = new Set((existingFiles ?? []).map((f) => f.name));

  const allSpecs = getAllCreateOptionSpecs();
  const missing = allSpecs
    .filter((s) => !existingNames.has(optionStorageKey(s.type, s.id)))
    .map((s) => ({ key: optionStorageKey(s.type, s.id), prompt: s.prompt }));

  const existingImageUrls: Record<string, string> = {};
  for (const s of allSpecs) {
    const key = optionStorageKey(s.type, s.id);
    if (existingNames.has(key)) {
      existingImageUrls[`${s.type}-${s.id}`] = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
    }
  }

  return NextResponse.json({ missing, existingImageUrls });
}

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  await ensureBucket();
  const blob = await req.blob();
  const buf = Buffer.from(await blob.arrayBuffer());
  const mimeType = blob.type || "image/jpeg";

  const { error } = await supabase.storage.from(BUCKET).upload(key, buf, { contentType: mimeType, upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the image key without extension so the client can index into optionImages
  const imageKey = key.replace(/\.jpg$/, "");
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  return NextResponse.json({ ok: true, imageKey, url: publicUrl });
}
