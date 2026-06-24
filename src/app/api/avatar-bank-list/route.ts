import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("avatar_bank")
    .select("id, description, image_url")
    .order("id");

  if (error) return NextResponse.json({ avatars: [] }, { status: 500 });
  return NextResponse.json({ avatars: data ?? [] });
}
