import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getFamilyContext } from "@/lib/authContext";

export const dynamic = "force-dynamic";

export interface DBChildProfile {
  id: string;
  name: string;
  age: number;
  gender: "boy" | "girl" | "other";
  avatar_emoji: string;
  favorite_animals: string[];
  favorite_themes: string[];
  preferred_figures?: string[];
  // Values picked once (onboarding or Profile > Edit) that get pre-applied
  // whenever a new story is created for this child — see lessonsUi.ts for
  // the catalog these ids/custom text come from.
  default_moral_lessons?: string[];
  interests?: string;
  avoid?: string;
  notes?: string;
  // TTS-only respelling of the name, confirmed by the parent during
  // onboarding's "Does this sound right?" flow — never shown in the UI or
  // script, only substituted into the text sent to TTS when this child's
  // real name appears in story narration.
  pronunciation_override?: string;
  created_at: number;
  updated_at: number;
}

export async function GET(req: NextRequest) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json([]);
  try {
    const { data, error } = await supabase
      .from("child_profiles")
      .select("*")
      // null = pre-migration legacy rows; visible until the backfill stamps them
      .or(`family_id.eq.${ctx.familyId},family_id.is.null`)
      .order("created_at", { ascending: true });

    if (error) {
      // Table not created yet — return empty array so UI uses mock fallback
      console.warn("[child-profiles] DB error:", error.message);
      return NextResponse.json([]);
    }
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  try {
    const body = await req.json() as Partial<DBChildProfile>;
    const now = Date.now();

    const row: DBChildProfile & { family_id: string } = {
      family_id: ctx.familyId,
      id: `cp-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(body.name ?? "").trim(),
      age: Math.max(1, Math.min(16, Number(body.age ?? 5))),
      gender: (["boy", "girl", "other"].includes(body.gender ?? "")) ? body.gender as "boy" | "girl" | "other" : "other",
      avatar_emoji: body.avatar_emoji ?? "⭐",
      favorite_animals: Array.isArray(body.favorite_animals) ? body.favorite_animals : [],
      favorite_themes: Array.isArray(body.favorite_themes) ? body.favorite_themes : [],
      preferred_figures: Array.isArray(body.preferred_figures) ? body.preferred_figures : [],
      default_moral_lessons: Array.isArray(body.default_moral_lessons) ? body.default_moral_lessons : [],
      interests: body.interests ?? "",
      avoid: body.avoid ?? "",
      notes: body.notes ?? "",
      pronunciation_override: body.pronunciation_override || undefined,
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
