import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST { token, userId } — validate invite and add user to family
export async function POST(req: Request) {
  const { token, userId } = await req.json();
  if (!token || !userId) return NextResponse.json({ error: "token and userId required" }, { status: 400 });

  // Look up invite
  const { data: invite, error: inviteErr } = await supabase
    .from("family_invites")
    .select("id, family_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteErr || !invite) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  if (invite.used_at) return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "This invite has expired" }, { status: 410 });

  // Check if user is already a member
  const { data: existing } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("family_id", invite.family_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    // Add to family
    const { error: memberErr } = await supabase
      .from("family_members")
      .insert({ family_id: invite.family_id, user_id: userId, role: "member" });
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    // Ensure user_profiles row exists
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, preferred_language: "en" }, { onConflict: "id" });
  }

  // Mark invite as used (single-use)
  await supabase
    .from("family_invites")
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, familyId: invite.family_id });
}
