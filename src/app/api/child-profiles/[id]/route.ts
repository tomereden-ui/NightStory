import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getFamilyContext } from "@/lib/authContext";
import type { DBChildProfile } from "../route";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  try {
    const body = await req.json() as Partial<DBChildProfile>;
    const { data, error } = await supabase
      .from("child_profiles")
      .update({ ...body, updated_at: Date.now() })
      .eq("id", params.id)
      .or(`family_id.eq.${ctx.familyId},family_id.is.null`)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  try {
    // Best-effort: strip this child from any story's child_ids first, so
    // deleting a profile doesn't leave dangling ids behind — those stories
    // stay in the library, they just drop back to "unassigned" instead of
    // silently referencing a child that no longer exists. Non-fatal: a
    // failure here shouldn't block the actual profile delete.
    try {
      const { data: affected } = await supabase
        .from("stories")
        .select("id, child_ids")
        .filter("child_ids", "cs", JSON.stringify([params.id]));
      if (affected?.length) {
        await Promise.all(affected.map((row) => {
          const remaining = ((row.child_ids as string[]) ?? []).filter((id) => id !== params.id);
          return supabase.from("stories").update({ child_ids: remaining.length ? remaining : null }).eq("id", row.id);
        }));
      }
    } catch (cleanupErr) {
      console.warn("[child-profiles DELETE] child_ids cleanup failed (non-fatal):", cleanupErr);
    }

    const { error } = await supabase
      .from("child_profiles")
      .delete()
      .eq("id", params.id)
      .or(`family_id.eq.${ctx.familyId},family_id.is.null`);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
