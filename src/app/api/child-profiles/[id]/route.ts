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
