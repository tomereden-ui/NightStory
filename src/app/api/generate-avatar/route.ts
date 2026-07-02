/**
 * POST /api/generate-avatar
 * Body: { description: string; type?: "child" | "adult" | "animal" | "narrator" }
 *
 * Generates a character portrait avatar via Imagen, uploads to Supabase storage,
 * saves to avatar_bank for future reuse, and returns the public URL.
 * Skips generation if an identical description is already in the bank.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateWithImagen } from "@/lib/services/imagenClient";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "avatars";

function descriptionHash(description: string): string {
  // Simple 32-bit hash → 8 hex chars, enough for storage key uniqueness
  let h = 0x811c9dc5;
  for (let i = 0; i < description.length; i++) {
    h ^= description.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function buildAvatarPrompt(description: string): string {
  return (
    `3D Pixar-style circular portrait avatar. ${description}. ` +
    `Centered composition, face and upper body clearly visible, expressive friendly face with large warm eyes. ` +
    `Clean soft gradient background (deep navy blue to dark teal). ` +
    `Warm cinematic rim lighting, soft volumetric glow. ` +
    `Children's animation art style — Pixar quality. ` +
    `Square canvas, subject perfectly centred for circular crop. ` +
    `No text, no letters, no background characters.`
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let description: string;
  let type: string | undefined;
  try {
    ({ description, type } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });

  description = description.trim();
  const dbType = type === "narrator" ? "adult" : (type ?? "adult");

  // ── Check if we already generated an avatar for this exact description ──────
  const { data: existing } = await supabase
    .from("avatar_bank")
    .select("image_url")
    .eq("description", description)
    .maybeSingle();

  if (existing?.image_url) {
    console.log("[AvatarGen] cache hit for:", description.slice(0, 60));
    return NextResponse.json({ avatarUrl: existing.image_url });
  }

  // ── Generate fresh avatar via Imagen ─────────────────────────────────────────
  console.log("[AvatarGen] generating:", description.slice(0, 80));
  const prompt = buildAvatarPrompt(description);
  const img = await generateWithImagen(prompt, apiKey);

  if (!img) {
    console.error("[AvatarGen] Imagen returned null for:", description.slice(0, 60));
    return NextResponse.json({ avatarUrl: null });
  }

  // ── Upload to Supabase storage ────────────────────────────────────────────────
  const ext = img.mimeType.includes("png") ? "png" : "jpg";
  const hash = descriptionHash(description);
  const storageKey = `char-avatar-${hash}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, img.buf, { contentType: img.mimeType, upsert: true });

  if (uploadErr) {
    console.error("[AvatarGen] upload failed:", uploadErr.message);
    return NextResponse.json({ avatarUrl: null });
  }

  const avatarUrl = supabase.storage.from(BUCKET).getPublicUrl(storageKey).data.publicUrl;

  // ── Save to avatar_bank for future reuse ─────────────────────────────────────
  // Tagged "_generated" so this one-off, story-specific avatar is excluded from
  // the general curated fallback pool (avatar-bank-list, avatarBankService) —
  // it's only ever meant to be reused via the exact-description cache lookup above.
  await supabase.from("avatar_bank").insert({
    description,
    image_url: avatarUrl,
    type: dbType,
    gender: "neutral",
    traits: ["_generated"],
  });

  console.log("[AvatarGen] saved:", storageKey, "→", avatarUrl.slice(-40));
  return NextResponse.json({ avatarUrl });
}
