import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let blocks: ScriptBlock[], age: number, lessons: string[], summary: string;
  try {
    ({ blocks, age = 6, lessons = [], summary = "" } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!blocks?.length) return NextResponse.json({ blocks: [] });

  // SFX blocks need no text validation — pass them straight through
  const indexedBlocks = blocks.map((b, i) => ({ ...b, _idx: i }));
  const sfxPass = indexedBlocks.filter((b) => b.characterName === "SFX");
  const textBlocks = indexedBlocks.filter((b) => b.characterName !== "SFX");

  if (textBlocks.length === 0) {
    return NextResponse.json({ blocks, changes: 0 });
  }

  const prompt = `You are a children's content safety reviewer for a bedtime story app.

CHILD AGE: ${age} years old
STORY LESSONS: ${lessons.length ? lessons.join(", ") : "none specified"}
STORY SUMMARY: ${summary || "not provided"}

Review each script block. For each:
- If it is age-appropriate and aligns with the story lessons → return it unchanged, status "ok"
- If it has a minor issue (slightly scary word, vocabulary too complex for age ${age}, conflicts with lessons) → rewrite ONLY the text to fix it, status "fixed"

Rules for age ${age}:
- No death, violence, or genuine fear
- Simple vocabulary a ${age}-year-old understands
- Only gentle tension that resolves warmly
- Reinforce the story's lessons where natural

Return ONLY a valid JSON array — no markdown, no explanation:
[{"index":0,"text":"...","status":"ok"},{"index":1,"text":"...","status":"fixed"},...]

Return exactly ${textBlocks.length} objects, one per block listed below.

BLOCKS:
${textBlocks.map((b, i) => `[${i}] ${b.characterName}: ${JSON.stringify(b.textPayload)}`).join("\n")}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    });
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const raw = result.response.text().trim();
    // Strip markdown fences if present
    const jsonStr = raw.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    const validated: { index: number; text: string; status: "ok" | "fixed" }[] = JSON.parse(jsonStr);

    let changes = 0;
    const resultBlocks = [...blocks];
    for (const item of validated) {
      const original = textBlocks[item.index];
      if (!original) continue;
      if (item.status === "fixed") {
        resultBlocks[original._idx] = { ...resultBlocks[original._idx], textPayload: item.text };
        changes++;
      }
    }

    return NextResponse.json({ blocks: resultBlocks, changes });
  } catch (err) {
    console.error("[validate-blocks] error:", err);
    // On any error, return original blocks unchanged — don't block the user
    return NextResponse.json({ blocks, changes: 0 });
  }
}
