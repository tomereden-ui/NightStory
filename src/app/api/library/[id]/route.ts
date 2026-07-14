import { NextRequest, NextResponse } from "next/server";
import { getEntry, moveToTrash } from "@/lib/libraryStore";
import { supabase } from "@/lib/supabase";
import { getFamilyContext } from "@/lib/authContext";
import type { ScriptBlock, StoryScene, MoralLesson } from "@/types";
import type { CharacterProfile } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  // getEntry hides other families' private stories; public ones stay readable.
  const entry = await getEntry(params.id, ctx.familyId);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  console.log(`[library PATCH] story=${id} — resolving auth...`);
  const ctx = await getFamilyContext(req);
  if (!ctx) {
    console.warn(`[library PATCH] story=${id} — REJECTED: no family context (not logged in, or user has no family)`);
    return NextResponse.json({ error: "No family" }, { status: 403 });
  }
  console.log(`[library PATCH] story=${id} — caller user=${ctx.userId} family=${ctx.familyId}`);

  let body: { blocks?: ScriptBlock[]; title?: string; summary?: string; childIds?: string[] | null; shareMessage?: string | null; coverFocusX?: number | null; coverFocusY?: number | null; scenes?: StoryScene[] | null; characterProfiles?: Record<string, CharacterProfile> | null; moralLessons?: MoralLesson[] | null };
  try {
    body = await req.json();
  } catch {
    console.warn(`[library PATCH] story=${id} — REJECTED: request body is not valid JSON`);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.blocks        !== undefined) updates.blocks         = body.blocks;
  if (body.title         !== undefined) updates.title          = body.title;
  if (body.summary       !== undefined) updates.summary        = body.summary;
  if (body.childIds      !== undefined) updates.child_ids      = body.childIds?.length ? body.childIds : null;
  if (body.shareMessage  !== undefined) updates.share_message  = body.shareMessage ?? null;
  if (body.coverFocusX   !== undefined) updates.cover_focus_x  = body.coverFocusX ?? null;
  if (body.coverFocusY   !== undefined) updates.cover_focus_y  = body.coverFocusY ?? null;
  if (body.scenes            !== undefined) updates.scenes             = body.scenes ?? null;
  if (body.characterProfiles !== undefined) updates.character_profiles = body.characterProfiles ?? null;
  if (body.moralLessons      !== undefined) updates.moral_lessons      = body.moralLessons ?? null;

  console.log(`[library PATCH] story=${id} — fields being updated: [${Object.keys(updates).join(", ")}]${updates.title !== undefined ? ` | new title: ${JSON.stringify(updates.title)}` : ""}`);

  if (Object.keys(updates).length === 0) {
    console.warn(`[library PATCH] story=${id} — REJECTED: body had no recognized fields (nothing to update)`);
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Ownership guard: only this family's stories are updatable (family_id null
  // = pre-migration legacy rows, editable as before until the backfill runs).
  //
  // .select() on the end is load-bearing, not decorative: Supabase's update()
  // returns {error: null} even when the filter matches zero rows (e.g. the
  // story belongs to a different family, or the id doesn't exist) — a
  // perfectly "successful" no-op that looks identical to a real save from
  // the caller's side. Without requesting the row back, this route would
  // return {ok: true} having silently changed nothing.
  const { data, error } = await supabase
    .from("stories")
    .update(updates)
    .eq("id", id)
    .or(`family_id.eq.${ctx.familyId},family_id.is.null`)
    .select("id");
  if (error) {
    console.error("[library PATCH] db error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (!data?.length) {
    // Zero rows matched — find out exactly why: does the story exist at all,
    // and if so, whose family does it actually belong to? This is the single
    // most useful line in this route when saves mysteriously "succeed" but
    // don't persist.
    const { data: actual } = await supabase.from("stories").select("id, family_id").eq("id", id).maybeSingle();
    if (!actual) {
      console.warn(`[library PATCH] story=${id} — REJECTED: 0 rows matched — this story id does not exist in the DB at all`);
    } else {
      console.warn(`[library PATCH] story=${id} — REJECTED: 0 rows matched — story's real family_id=${actual.family_id}, but caller's family_id=${ctx.familyId} (mismatch)`);
    }
    return NextResponse.json({ error: "Not found, or not owned by your family" }, { status: 404 });
  }
  console.log(`[library PATCH] story=${id} — SUCCESS: 1 row updated`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  try {
    const ok = await moveToTrash(params.id, ctx.familyId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[library DELETE] moveToTrash failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 500 });
  }
}
