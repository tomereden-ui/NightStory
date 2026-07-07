import { NextRequest, NextResponse } from "next/server";
import { detectGeneratedLanguage } from "@/lib/services/scriptGenerationHelpers";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

// For a story whose language was never persisted (created before this field
// existed, or a classic/legacy entry) -- opening it for editing would
// otherwise fall back to the app's own UI language, which can easily be
// wrong for the story's actual content (e.g. a Hebrew classic opened by an
// admin whose own UI is set to English). Detects from the real blocks
// instead of guessing.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  const { blocks } = await req.json() as { blocks: ScriptBlock[] };
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }

  const language = await detectGeneratedLanguage(blocks, apiKey);
  return NextResponse.json({ language });
}
