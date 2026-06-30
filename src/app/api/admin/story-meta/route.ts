import { NextRequest, NextResponse } from "next/server";
import { geminiPost } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

interface Block { characterName: string; textPayload: string; }

const AGE_GROUPS = ["2-4", "4-6", "6-8", "8-10", "10-12"] as const;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const { blocks, title } = await req.json() as { blocks: Block[]; title?: string };
  if (!Array.isArray(blocks) || !blocks.length) {
    return NextResponse.json({ error: "blocks required" }, { status: 400 });
  }

  const scriptText = blocks
    .map((b) => `${b.characterName}: ${b.textPayload}`)
    .join("\n");

  const prompt = `You are analyzing a children's bedtime audio drama script.
Story title: "${title ?? "Untitled"}"

Script:
${scriptText}

Return ONLY valid JSON (no markdown):
{
  "summary": "1-2 sentence summary for parents (what the story is about)",
  "ageGroup": "one of: 2-4, 4-6, 6-8, 8-10, 10-12",
  "coverPrompt": "a vivid Pixar-style 3D illustration prompt for the cover (2 sentences, child-safe, magical)"
}

For ageGroup, pick the range that best matches the vocabulary, themes, and complexity of this script.`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text as string) as {
      summary?: string; ageGroup?: string; coverPrompt?: string;
    };
    const ageGroup = AGE_GROUPS.includes(parsed.ageGroup as typeof AGE_GROUPS[number])
      ? parsed.ageGroup
      : "4-6";
    return NextResponse.json({
      summary: parsed.summary ?? "",
      ageGroup,
      coverPrompt: parsed.coverPrompt ?? `${title ?? "Story"} — magical Pixar-style children's bedtime illustration`,
    });
  } catch {
    return NextResponse.json({ summary: "", ageGroup: "4-6", coverPrompt: title ?? "" });
  }
}
