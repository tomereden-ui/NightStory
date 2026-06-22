import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface DBChildProfile {
  id: string;
  name: string;
  age: number;
  gender: "boy" | "girl" | "other";
  avatar_emoji: string;
  favorite_animals: string[];
  favorite_themes: string[];
  interests?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("child_profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<DBChildProfile>;
    const now = Date.now();

    const row: DBChildProfile = {
      id: `cp-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(body.name ?? "").trim(),
      age: Math.max(1, Math.min(16, Number(body.age ?? 5))),
      gender: (["boy", "girl", "other"].includes(body.gender ?? "")) ? body.gender as "boy" | "girl" | "other" : "other",
      avatar_emoji: body.avatar_emoji ?? "⭐",
      favorite_animals: Array.isArray(body.favorite_animals) ? body.favorite_animals : [],
      favorite_themes: Array.isArray(body.favorite_themes) ? body.favorite_themes : [],
      interests: body.interests ?? "",
      notes: body.notes ?? "",
      created_at: now,
      updated_at: now,
    };

    if (!row.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("child_profiles")
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
