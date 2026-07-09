import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

// Gates the Director's Note free-text field: before "Update Script" can be
// enabled for a manually-typed instruction, Gemini checks (a) whether the
// free text alone is a reasonable revision request at all -- either as a
// general story-editing request, or specifically relevant to what's
// actually IN this script -- and (b) whether it logically contradicts any
// of the currently-selected preset mood chips, or those chips contradict
// each other (e.g. "make it shorter" alongside an instruction that only
// makes sense if the story gets longer). Any problems found come back as a
// short list so the user can see exactly what's wrong, rather than the
// request silently failing later in /api/revise-script.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  const { instruction, chipInstructions, blocks, summary } = await req.json() as {
    instruction?: string;
    chipInstructions?: string[];
    blocks?: ScriptBlock[];
    summary?: string;
  };

  const freeText = instruction?.trim() ?? "";
  const chips = (chipInstructions ?? []).map((c) => c.trim()).filter(Boolean);

  if (!freeText && chips.length === 0) {
    return NextResponse.json({ error: "Nothing to check." }, { status: 400 });
  }

  const scriptSample = (blocks ?? [])
    .filter((b) => b.characterName !== "SFX")
    .slice(0, 10)
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n")
    .slice(0, 1500);

  const systemInstruction = `You are a script editor reviewing a director's revision instructions for a children's bedtime story script (ages 3-10).

You will be given:
- PRESET MOOD INSTRUCTIONS: zero or more pre-written quick options the director selected (individually reasonable on their own).
- FREE-TEXT INSTRUCTION: optional text the director typed themselves.

Check for problems across all of the following:
1. Is the free-text instruction (if any) a reasonable revision request at all -- either a sensible general editing request (tone, pacing, length, mood, language, content-safety tweak), or specifically relevant to what's actually in THIS script (its real characters, setting, plot)? Flag it if it's unrelated to editing a story script, nonsensical, references characters/elements that don't exist in this script when it depends on them existing, or is inappropriate for a children's bedtime story.
2. Does the free-text instruction logically contradict any of the selected preset mood instructions (e.g. asking to shorten the story while also asking to add a whole new subplot)?
3. Do any of the selected preset mood instructions contradict EACH OTHER (e.g. one implies the story must get shorter while another implies it must get longer)?
4. Does the free-text instruction contradict itself internally?

Return ONLY raw JSON, no markdown fences:
{ "issues": ["<short, specific, one-sentence problem describing what conflicts with what, under 20 words, in the same language as the free-text instruction if provided, else English>", ...] }

If there are no problems at all, return { "issues": [] }. Return at most 5 issues, most important first.`;

  const prompt = `STORY SUMMARY: ${summary || "not provided"}

STORY SCRIPT SAMPLE:
${scriptSample || "not provided"}

PRESET MOOD INSTRUCTIONS SELECTED:
${chips.length ? chips.map((c, i) => `${i + 1}. ${c}`).join("\n") : "none selected"}

FREE-TEXT INSTRUCTION: ${freeText ? `"${freeText}"` : "(none typed)"}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 400,
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    const parsed = JSON.parse(text) as { issues?: string[] };
    const issues = (parsed.issues ?? []).map((i) => i.trim()).filter(Boolean).slice(0, 5);
    return NextResponse.json({ reasonable: issues.length === 0, issues });
  } catch {
    // A validation hiccup shouldn't permanently block the user -- treat as
    // reasonable (fail open) rather than stuck disabled with no explanation.
    return NextResponse.json({ reasonable: true, issues: [] });
  }
}
