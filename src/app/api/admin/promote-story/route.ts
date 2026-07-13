import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Admin-only global action — deliberately not family-scoped, unlike
// /api/library/[id] PATCH, since promoting features a story on every
// family's home hero banner regardless of who owns it.
export async function POST(req: NextRequest) {
  let body: { id?: string; promoted?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (typeof body.promoted !== "boolean") return NextResponse.json({ error: "promoted must be a boolean" }, { status: 400 });

  // Only one story is ever promoted at a time — clear any previous pick
  // before setting the new one, so the hero banner can't end up with two
  // "promoted" rows and an ambiguous pick between them.
  if (body.promoted) {
    const { error: clearError } = await supabase.from("stories").update({ promoted: false }).eq("promoted", true);
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("stories")
    .update({ promoted: body.promoted })
    .eq("id", id)
    .select("id, title")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No story found with that ID" }, { status: 404 });

  return NextResponse.json({ ok: true, id: data.id, title: data.title, promoted: body.promoted });
}
