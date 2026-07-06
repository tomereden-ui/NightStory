import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import { updateMoralLessons } from "@/lib/libraryStore";
import type { ScriptBlock, MoralLesson } from "@/types";

// Kept in sync with LessonStep.tsx's LESSONS catalog by label — duplicated
// here (rather than imported) so this server route doesn't pull in a
// "use client" component just for a label list.
const CANONICAL_LESSONS = [
  "Bravery", "Friendship", "Kindness", "Honesty", "Perseverance",
  "Sharing", "Patience", "Respecting differences", "Responsibility", "Gratitude",
];

const SYSTEM_INSTRUCTION = `You are a children's literature analyst for NightStory, a bedtime-story audio app for kids aged 3-10.
You will receive a story's script (narration + dialogue lines). Identify which moral/values lessons are MEANINGFULLY embedded — shown through what a character does or decides, not just mentioned in passing.

Prefer naming a value from this list when it fits: ${CANONICAL_LESSONS.join(", ")}.
If a different, clearly distinct value is strongly present and none of the above fit, you may name it concisely (1-3 words, title case).
Do not force a lesson that isn't really there — an empty result is fine for a purely fun/silly story with no real moral content.

Return ONLY raw JSON, no markdown fences: { "lessons": [{ "lesson": "<name>", "how": "<one short, parent-friendly sentence on the specific moment that shows it>" }] }
Order by how central the lesson is to the story, most central first. Return at most 4 lessons.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  const { blocks, storyId } = await req.json() as { blocks: ScriptBlock[]; storyId?: string };

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }

  const scriptText = blocks
    .filter((b) => b.characterName !== "SFX" && b.textPayload?.trim())
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n");

  if (!scriptText.trim()) {
    return NextResponse.json({ lessons: [] as MoralLesson[] });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: SYSTEM_INSTRUCTION });
    const result = await model.generateContent(`Story script:\n\n${scriptText}`);
    const totalTokens = result.response.usageMetadata?.totalTokenCount;
    if (totalTokens) trackGemini(totalTokens).catch(() => {});

    const text = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    let parsed: { lessons?: { lesson?: string; how?: string }[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Gemini returned invalid JSON.", raw: text.slice(0, 300) }, { status: 502 });
    }

    const lessons: MoralLesson[] = (parsed.lessons ?? [])
      .filter((l): l is { lesson: string; how: string } => Boolean(l.lesson?.trim() && l.how?.trim()))
      .map((l) => ({ lesson: l.lesson.trim(), how: l.how.trim() }))
      .slice(0, 4);

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
