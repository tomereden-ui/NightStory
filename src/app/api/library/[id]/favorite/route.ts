import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  let childId: string, favorited: boolean;
  try {
    ({ childId, favorited } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!childId || typeof favorited !== "boolean") {
    return NextResponse.json({ error: "childId and favorited required" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("stories")
    .select("favorited_by")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 502 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current: string[] = Array.isArray(row.favorited_by) ? row.favorited_by : [];
  const next = favorited
    ? Array.from(new Set([...current, childId]))
    : current.filter((c) => c !== childId);

  const { error: updateErr } = await supabase
    .from("stories")
    .update({ favorited_by: next })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 502 });

  return NextResponse.json({ favoritedBy: next });
}
