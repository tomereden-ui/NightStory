import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

// Gates the Director's Note free-text field: before "Update Script" can be
// enabled for a manually-typed instruction (chip-picked instructions are
// pre-vetted and skip this), Gemini checks whether it's a reasonable
// revision instruction at all -- either as a general story-editing request,
// or specifically relevant to what's actually IN this script (characters,
// setting, plot). Off-topic, nonsensical, or unsafe-for-children requests
// come back with a short reason so the user understands why it's blocked,
// rather than the request silently failing later in /api/revise-script.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  const { instruction, blocks, summary } = await req.json() as {
    instruction: string;
    blocks?: ScriptBlock[];
    summary?: string;
  };

  if (!instruction?.trim()) {
    return NextResponse.json({ error: "instruction is required." }, { status: 400 });
  }

  const scriptSample = (blocks ?? [])
    .filter((b) => b.characterName !== "SFX")
    .slice(0, 10)
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n")
    .slice(0, 1500);

  const systemInstruction = `You are a script editor reviewing a director's instruction meant to revise a children's bedtime story script (ages 3-10).

Determine if the instruction is REASONABLE to apply as a revision -- either:
  (a) a sensible general editing request (tone, pacing, length, mood, language, content-safety tweak), or
  (b) specifically relevant to what's actually in THIS script (its real characters, setting, plot).

Reject as unreasonable: instructions unrelated to editing a story script at all, nonsensical requests, requests
referencing characters/elements that don't exist in this script when the instruction depends on them existing,
or anything inappropriate for a children's bedtime story.

Return ONLY raw JSON, no markdown fences: { "reasonable": true|false, "reason": "<if false, ONE short sentence
under 15 words explaining why, in the same language as the instruction; if true, empty string>" }`;

  const prompt = `STORY SUMMARY: ${summary || "not provided"}

STORY SCRIPT SAMPLE:
${scriptSample || "not provided"}

DIRECTOR'S INSTRUCTION: "${instruction.trim()}"`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200,
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    const parsed = JSON.parse(text) as { reasonable?: boolean; reason?: string };
    return NextResponse.json({
      reasonable: parsed.reasonable !== false,
      reason: parsed.reason?.trim() || "",
    });
  } catch {
    // A validation hiccup shouldn't permanently block the user -- treat as
    // reasonable (fail open) rather than stuck disabled with no explanation.
    return NextResponse.json({ reasonable: true, reason: "" });
  }
}
