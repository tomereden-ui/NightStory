import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getFamilyContext } from "@/lib/authContext";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  console.log(`[cover PATCH] story=${id} — resolving auth...`);
  const ctx = await getFamilyContext(req);
  if (!ctx) {
    console.warn(`[cover PATCH] story=${id} — REJECTED: no family context (not logged in, or user has no family)`);
    return NextResponse.json({ error: "No family" }, { status: 403 });
  }
  console.log(`[cover PATCH] story=${id} — caller user=${ctx.userId} family=${ctx.familyId}`);

  let mimeType: string, data: string;
  try {
    ({ mimeType, data } = await req.json());
  } catch {
    console.warn(`[cover PATCH] story=${id} — REJECTED: request body is not valid JSON`);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!mimeType || !data) return NextResponse.json({ error: "mimeType and data required" }, { status: 400 });

  const ext = mimeType.includes("png") ? "png" : "jpg";
  // Use a timestamped key so every upload produces a unique URL, bypassing CDN caches
  const storageKey = `${id}-${Date.now()}.${ext}`;

  const buf = Buffer.from(data, "base64");
  const { error: uploadErr } = await supabase.storage
    .from("covers")
    .upload(storageKey, buf, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    console.error("[cover PATCH] upload failed:", uploadErr.message);
    return NextResponse.json({ error: uploadErr.message }, { status: 502 });
  }

  const publicUrl = supabase.storage.from("covers").getPublicUrl(storageKey).data.publicUrl;

  // Same ownership guard + row-verification as the main story PATCH route —
  // .update() alone returns {error: null} even when the filter matches zero
  // rows, which would otherwise report success while the DB row (and the
  // uploaded file above) silently doesn't correspond to anything the caller
  // can actually see.
  const { data: updatedRows, error: dbErr } = await supabase
    .from("stories")
    .update({ cover_url: publicUrl })
    .eq("id", id)
    .or(`family_id.eq.${ctx.familyId},family_id.is.null`)
    .select("id");

  if (dbErr) {
    console.error("[cover PATCH] db update failed:", dbErr.message);
    return NextResponse.json({ error: dbErr.message }, { status: 502 });
  }
  if (!updatedRows?.length) {
    const { data: actual } = await supabase.from("stories").select("id, family_id").eq("id", id).maybeSingle();
    if (!actual) {
      console.warn(`[cover PATCH] story=${id} — REJECTED: 0 rows matched — this story id does not exist in the DB at all`);
    } else {
      console.warn(`[cover PATCH] story=${id} — REJECTED: 0 rows matched — story's real family_id=${actual.family_id}, but caller's family_id=${ctx.familyId} (mismatch)`);
    }
    return NextResponse.json({ error: "Not found, or not owned by your family" }, { status: 404 });
  }

  console.log(`[cover PATCH] story=${id} — SUCCESS: 1 row updated, new cover=${publicUrl}`);
  return NextResponse.json({ coverUrl: publicUrl });
}
