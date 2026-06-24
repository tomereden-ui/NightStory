/**
 * POST /api/admin/seed-avatar-bank
 *
 * Generates all 50 avatars with Imagen and stores them in Supabase.
 * Skips entries that already have a row in avatar_bank (safe to re-run).
 *
 * Optional body params:
 *   { start?: number, count?: number }  — process a subset (for environments with short timeouts)
 *   default: all 50
 *
 * Requires the SQL migration in supabase/avatar-bank-migration.sql to be run first.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateWithImagen } from "@/lib/services/imagenClient";
import { AVATAR_BANK, AVATAR_STYLE_SUFFIX } from "@/config/avatarBankPrompts";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — may need multiple calls on hobby-tier deployments

const BUCKET = "avatars";

async function ensureAvatarsBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[SeedAvatars] bucket create:", error.message);
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let start = 0, count = AVATAR_BANK.length;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.start === "number") start = body.start;
    if (typeof body.count === "number") count = body.count;
  } catch { /* no body */ }

  const slice = AVATAR_BANK.slice(start, start + count);

  await ensureAvatarsBucket();

  // Fetch existing descriptions to skip already-seeded entries
  const { data: existing } = await supabase
    .from("avatar_bank")
    .select("description");
  const seededDescs = new Set((existing ?? []).map((r: { description: string }) => r.description));

  const results: { index: number; description: string; status: "seeded" | "skipped" | "error"; reason?: string }[] = [];

  for (let i = 0; i < slice.length; i++) {
    const def = slice[i];
    const globalIndex = start + i;

    if (seededDescs.has(def.description)) {
      results.push({ index: globalIndex, description: def.description.slice(0, 50), status: "skipped" });
      console.log(`[SeedAvatars] ${globalIndex}: skipped (already exists)`);
      continue;
    }

    if (i > 0) await new Promise((r) => setTimeout(r, 7000));

    try {
      // 1. Generate image
      const imagePrompt = def.description + AVATAR_STYLE_SUFFIX;
      const img = await generateWithImagen(imagePrompt, apiKey);
      if (!img) throw new Error("Imagen returned null");

      // 2. Upload to Supabase Storage
      const fileName = `avatar-${globalIndex.toString().padStart(3, "0")}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, img.buf, { contentType: img.mimeType, upsert: true });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;

      // 3. Insert into avatar_bank (no embedding — matching uses Gemini Flash)
      const { error: insertErr } = await supabase.from("avatar_bank").insert({
        description: def.description,
        image_url: imageUrl,
        type: def.type,
        gender: def.gender,
        traits: def.traits,
      });
      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

      results.push({ index: globalIndex, description: def.description.slice(0, 50), status: "seeded" });
      console.log(`[SeedAvatars] ${globalIndex}: seeded → ${fileName}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      results.push({ index: globalIndex, description: def.description.slice(0, 50), status: "error", reason });
      console.error(`[SeedAvatars] ${globalIndex}: ERROR —`, reason);
    }
  }

  const seeded  = results.filter((r) => r.status === "seeded").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors  = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ seeded, skipped, errors, results });
}
