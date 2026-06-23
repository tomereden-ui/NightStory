import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let characters: string[], summary: string | undefined;
  try {
    ({ characters, summary } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!characters?.length) return NextResponse.json({});

  // Always treat "Narrator" as narrator without calling AI
  const nonNarrators = characters.filter((c) => c !== "Narrator" && c !== "SFX");
  const result: Record<string, string> = {};
  if (characters.includes("Narrator")) result["Narrator"] = "narrator";

  if (!nonNarrators.length) return NextResponse.json(result);

  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are classifying characters in a children's bedtime story.

Story summary: ${summary ?? "a bedtime adventure"}

Characters to classify: ${nonNarrators.join(", ")}

Classify each character as EXACTLY one of these types:
- "child" — a child, kid, baby, or young creature
- "adult" — a grown-up human, parent, grandparent, wizard, etc.
- "animal" — any animal, creature, monster, fairy, mythical being, robot, or non-human

Respond with ONLY a valid JSON object. No markdown, no explanation.
Example: {"Luna": "child", "Grandpa": "adult", "Bunny": "animal"}`,
        }],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = geminiText(data);
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    return NextResponse.json({ ...result, ...parsed });
  } catch (err) {
    console.warn("[ClassifyChars] AI classification failed, using fallback:", err);
    for (const name of nonNarrators) result[name] = "adult";
    return NextResponse.json(result);
  }
}
