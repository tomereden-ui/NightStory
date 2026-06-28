import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST — create an invite token for the caller's family
export async function POST(req: Request) {
  const { familyId } = await req.json();
  if (!familyId) return NextResponse.json({ error: "familyId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("family_invites")
    .insert({ family_id: familyId })
    .select("token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token: data.token });
}
