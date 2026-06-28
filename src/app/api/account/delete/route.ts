import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Deletes the authenticated user's account and all associated data.
// Requires the user's JWT (from the browser session) in the Authorization header.
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the token and get the user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  // Find the user's family
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership) {
    const { family_id, role } = membership;

    if (role === "owner") {
      // Owner: delete the entire family and all its data (cascades via FK)
      await supabase.from("families").delete().eq("id", family_id);
    } else {
      // Member: just remove from family, leave family intact
      await supabase.from("family_members").delete()
        .eq("family_id", family_id).eq("user_id", userId);
    }
  }

  // Delete user profile
  await supabase.from("user_profiles").delete().eq("id", userId);

  // Delete the auth user (requires service role)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[DeleteAccount] auth.admin.deleteUser failed:", deleteError.message);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
