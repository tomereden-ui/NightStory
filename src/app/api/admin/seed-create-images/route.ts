import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";
import { getAllCreateOptionSpecs, optionStorageKey } from "@/config/createFlowImages";

// Card thumbnails render at a few hundred CSS px wide at most — resize the
// raw Gemini output down so they load near-instantly instead of shipping
// multi-megabyte originals to a 16:9 grid card.
async function compressForCard(buf: Buffer): Promise<Buffer> {
  return sharp(buf).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 74 }).toBuffer();
}

export const dynamic = "force-dynamic";

const BUCKET = "story-options";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image";

const STYLE_SUFFIX =
  "3D animated movie still, Pixar style, high-fidelity render, vibrant colors, cinematic lighting, magical atmosphere, no text or letters.";

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[seed-create-images] bucket:", error.message);
  }
}

export async function GET() {
  await ensureBucket();
  const { data: existingFiles } = await supabase.storage.from(BUCKET).list("", { limit: 200 });
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No Gemini API key" }, { status: 500 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key param" }, { status: 400 });

  let prompt: string;
  try {
    ({ prompt } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  await ensureBucket();

  // Generate image via Gemini
  const fullPrompt = `${prompt} ${STYLE_SUFFIX}`;
  let imageData: string;

  try {
    const res = await fetch(`${GEMINI_BASE}/${IMAGE_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    });

    const raw = await res.json();
    type Part = { inlineData?: { mimeType?: string; data?: string } };
    const parts: Part[] = raw?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      console.error("[seed-create-images] No image returned for key:", key, "reason:", raw?.candidates?.[0]?.finishReason);
      return NextResponse.json({ error: "No image returned", finishReason: raw?.candidates?.[0]?.finishReason }, { status: 502 });
    }

    imageData = imagePart.inlineData.data;
  } catch (err) {
    console.error("[seed-create-images] Gemini error:", err);
    return NextResponse.json({ error: "Gemini request failed" }, { status: 500 });
  }

  // Compress before upload — card thumbnails don't need the multi-MB
  // originals Gemini returns, and the smaller file makes the placeholder→
  // photo swap in the UI effectively instant.
  const rawBuf = Buffer.from(imageData, "base64");
  let buf: Buffer;
  try {
    buf = await compressForCard(rawBuf);
  } catch (err) {
    console.warn("[seed-create-images] compression failed, uploading original:", err);
    buf = rawBuf;
  }

  // Upload to Supabase
  const storageKey = (key.replace(/\.(jpg|png)$/, "")) + ".jpg";
  const { error } = await supabase.storage.from(BUCKET).upload(storageKey, buf, { contentType: "image/jpeg", upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip version prefix (e.g. "v3-") so imageKey matches the frontend's optionImages lookup ("world-deep-ocean")
  const imageKey = storageKey.replace(/\.(jpg|png)$/, "").replace(/^v\d+-/, "");
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storageKey).data.publicUrl;
  console.log("[seed-create-images] Generated + cached:", storageKey, "→ key:", imageKey);
  return NextResponse.json({ ok: true, imageKey, url: publicUrl });
}
