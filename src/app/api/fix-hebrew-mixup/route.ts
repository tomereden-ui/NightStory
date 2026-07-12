import { NextRequest, NextResponse } from "next/server";
import { fixHebrewLatinMixup } from "@/lib/services/scriptGenerationHelpers";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

// Thin wrapper around fixHebrewLatinMixup for callers that don't already run
// server-side (e.g. admin's add-story flow, a client component) — the same
// Hebrew/Latin letter-mixup repair generate-story and five-question-story
// apply automatically at generation time.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  const { blocks } = await req.json() as { blocks: ScriptBlock[] };
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }

  const fixed = await fixHebrewLatinMixup(blocks, apiKey);
  return NextResponse.json({ blocks: fixed });
}
