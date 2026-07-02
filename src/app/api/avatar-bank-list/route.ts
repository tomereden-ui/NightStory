import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("avatar_bank")
    .select("id, description, image_url, type, gender, traits")
    .order("id");

  if (error) return NextResponse.json({ avatars: [] }, { status: 500 });

  // Rows tagged "_generated" are one-off avatars auto-generated for a specific
  // story character's exact description (see /api/generate-avatar). They're an
  // exact-match cache, not general-purpose portraits — excluded here so a new
  // story's fallback avatar never lands on a previous story's leftover character art.
  const curated = (data ?? []).filter((r) => !(r.traits as string[] | null)?.includes("_generated"));
  return NextResponse.json({ avatars: curated });
}
