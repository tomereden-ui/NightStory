import { NextRequest, NextResponse } from "next/server";
import { updateMoralLessons } from "@/lib/libraryStore";
import { analyzeLessonsForStory } from "@/lib/services/storyPolicies";
import type { ScriptBlock, MoralLesson } from "@/types";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  const { blocks, storyId, language } = await req.json() as { blocks: ScriptBlock[]; storyId?: string; language?: string };

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }

  try {
    const lessons: MoralLesson[] = await analyzeLessonsForStory(blocks, apiKey, language, storyId);

    if (storyId) {
      try {
        await updateMoralLessons(storyId, lessons);
      } catch (err) {
        // Don't fail the request over a persistence hiccup — the analysis
        // still displays; it'll just be re-saved next time it re-runs.
        console.warn("[analyze-lessons] updateMoralLessons failed:", err);
      }
    }

    return NextResponse.json({ lessons });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
