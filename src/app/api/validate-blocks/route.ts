import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import type { ScriptBlock } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Same external-guidance pattern as validate-script (config/story-guidance.txt)
// and the Hebrew letter check (config/hebrew-letter-check.txt) — the actual
// review criteria live in a plain-text file editable without touching code.
// {{AGE}} is filled in per-request since the reviewed age varies per story.
function readGuidance(age: number): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "config", "validate-blocks-guidance.txt"), "utf-8");
    return raw.replace(/\{\{AGE\}\}/g, String(age));
  } catch {
    return "";
  }
}

function readGrammarPassGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "validate-blocks-grammar-pass.txt"), "utf-8");
  } catch {
    return "";
  }
}

// Strips a block's leading [performance tag] and returns both pieces —
// shared by pass 1 and pass 2 since both need the same tag-hold-and-
// reattach handling around whatever Gemini returns.
function stripTag(textPayload: string): { tag: string; bareText: string } {
  const tagMatch = textPayload.match(/^(\[[^\]]+\]\s*)/);
  return tagMatch ? { tag: tagMatch[1], bareText: textPayload.slice(tagMatch[1].length) } : { tag: "", bareText: textPayload };
}

type IndexedTextBlock = { _idx: number; characterName: string; tag: string; bareText: string };

// Runs one Gemini review pass and merges any fixes directly into
// resultBlocks (mutated in place). Failure in one pass never discards a
// fix another pass already made — resultBlocks starts as a copy of the
// original blocks, so a total failure across every pass still degrades to
// the safe "nothing changed" result.
async function runReviewPass(
  genAI: GoogleGenerativeAI,
  promptText: string,
  passBlocks: IndexedTextBlock[],
  resultBlocks: ScriptBlock[],
  passLabel: string,
): Promise<number> {
  let changes = 0;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } },
    });
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    const validated = JSON.parse(jsonStr) as { index: number; text: string; status: "ok" | "fixed" }[];

    for (const item of validated) {
      const original = passBlocks[item.index];
      if (!original || item.status !== "fixed" || !item.text?.trim()) continue;
      // Gemini never saw the tag (stripped before the prompt was built), so
      // its reply is always bare spoken text — just re-prepend the tag we
      // held onto, no detection needed.
      const newText = `${original.tag}${item.text.trim()}`;
      resultBlocks[original._idx] = { ...resultBlocks[original._idx], textPayload: newText };
      console.log(`[validate-blocks][${passLabel}] Fixed "${original.characterName}" — before: ${JSON.stringify(original.bareText)} | after: ${JSON.stringify(item.text.trim())}`);
      changes++;
    }
  } catch (err) {
    console.warn(`[validate-blocks][${passLabel}] failed, keeping prior result:`, err);
  }
  return changes;
}

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

  // SFX blocks need no text validation — pass them straight through.
  const textBlocks: IndexedTextBlock[] = blocks
    .map((b, i) => ({ _idx: i, characterName: b.characterName, ...stripTag(b.textPayload) }))
    .filter((b) => b.characterName !== "SFX");

  if (textBlocks.length === 0) {
    return NextResponse.json({ blocks, changes: 0 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const resultBlocks = [...blocks];
  let changes = 0;

  // ── Pass 1: combined age/content/grammar review ────────────────────────
  const pass1Prompt = `You are a children's content safety and language quality reviewer for a bedtime story app.

CHILD AGE: ${age} years old
STORY LESSONS: ${lessons.length ? lessons.join(", ") : "none specified"}
STORY SUMMARY: ${summary || "not provided"}

${readGuidance(age)}

Return ONLY a valid JSON array containing ONLY the blocks you fixed — no markdown, no explanation:
[{"index":1,"text":"the corrected spoken text","status":"fixed"},...]

Return an empty array [] if every block is already fine. Never echo blocks that needed no change — the app keeps unlisted blocks exactly as they are.

BLOCKS:
${textBlocks.map((b, i) => `[${i}] ${b.characterName}: ${JSON.stringify(b.bareText)}`).join("\n")}`;
  changes += await runReviewPass(genAI, pass1Prompt, textBlocks, resultBlocks, "pass1-content");

  // ── Pass 2: dedicated grammar/typo-only proofread ───────────────────────
  // Pass 1 judges age-appropriateness AND grammar in one shot, and can miss
  // a typo that co-occurs in a block it's already busy rewriting for content
  // — measured live: a real Hebrew script had a missing-letter typo survive
  // 8/8 trials when a tone edit landed in the same block, but a fully
  // separate grammar-only pass (no competing content framing) caught it
  // 3/3. Re-proofreads pass 1's own output (not the original text), so a
  // block flagged by both passes gets both fixes instead of one overwriting
  // the other.
  const pass2Blocks: IndexedTextBlock[] = resultBlocks
    .map((b, i) => ({ _idx: i, characterName: b.characterName, ...stripTag(b.textPayload) }))
    .filter((b) => b.characterName !== "SFX");
  const pass2Prompt = `${readGrammarPassGuidance()}

Return ONLY a valid JSON array containing ONLY the blocks you fixed — no markdown, no explanation:
[{"index":1,"text":"the corrected spoken text","status":"fixed"},...]

Return an empty array [] if every block is already fine. Never echo blocks that needed no change — the app keeps unlisted blocks exactly as they are.

BLOCKS:
${pass2Blocks.map((b, i) => `[${i}] ${b.characterName}: ${JSON.stringify(b.bareText)}`).join("\n")}`;
  changes += await runReviewPass(genAI, pass2Prompt, pass2Blocks, resultBlocks, "pass2-grammar");

  if (changes > 0) console.log(`[validate-blocks] ${changes} total fix(es) across both passes, ${textBlocks.length} block(s) reviewed.`);

  return NextResponse.json({ blocks: resultBlocks, changes });
}
