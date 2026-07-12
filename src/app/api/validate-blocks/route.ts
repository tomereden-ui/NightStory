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

  // SFX blocks need no text validation — pass them straight through. Strip
  // each block's leading [performance tag] before it ever reaches Gemini —
  // rather than sending it and instructing Gemini not to touch it (the old
  // approach, which occasionally lost the tag anyway: confirmed live,
  // "[curious] What is that twinkeling lihgt..." came back fixed but
  // tagless). Gemini now never sees it, so it can't drop or reword it —
  // the original tag is simply re-prepended once the fix comes back.
  const indexedBlocks = blocks.map((b, i) => {
    const tagMatch = b.textPayload.match(/^(\[[^\]]+\]\s*)/);
    return { ...b, _idx: i, tag: tagMatch?.[1] ?? "", bareText: tagMatch ? b.textPayload.slice(tagMatch[1].length) : b.textPayload };
  });
  const sfxPass = indexedBlocks.filter((b) => b.characterName === "SFX");
  const textBlocks = indexedBlocks.filter((b) => b.characterName !== "SFX");

  if (textBlocks.length === 0) {
    return NextResponse.json({ blocks, changes: 0 });
  }

  const prompt = `You are a children's content safety and language quality reviewer for a bedtime story app.

CHILD AGE: ${age} years old
STORY LESSONS: ${lessons.length ? lessons.join(", ") : "none specified"}
STORY SUMMARY: ${summary || "not provided"}

${readGuidance(age)}

Return ONLY a valid JSON array containing ONLY the blocks you fixed — no markdown, no explanation:
[{"index":1,"text":"the corrected spoken text","status":"fixed"},...]

Return an empty array [] if every block is already fine. Never echo blocks that needed no change — the app keeps unlisted blocks exactly as they are.

BLOCKS:
${textBlocks.map((b, i) => `[${i}] ${b.characterName}: ${JSON.stringify(b.bareText)}`).join("\n")}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // The response now contains ONLY the blocks Gemini fixed (the merge
      // loop below has always applied just the status==="fixed" entries, so
      // unlisted blocks pass through untouched) — on a clean script that's
      // an empty array instead of a full echo of every block's text, which
      // was costing ~10s+ of pure output generation per call and, at the
      // old 4096 default cap, silently truncating mid-JSON on longer
      // scripts. 8192 comfortably fits dozens of fixed blocks; a parse
      // failure (see finishReason logging below) degrades to returning the
      // original blocks unchanged, same as before. responseMimeType keeps
      // Gemini in native structured-JSON mode (properly escaped strings, no
      // markdown fences) — same as characterProfiler.ts.
      // A capped thinking budget (was 0) lets Gemini actually reason per
      // block instead of pattern-matching across three judgment axes (age/
      // lessons/grammar) at once in a single pass — measured live at +409
      // tokens (~$0.00016) and +~1.5-1.8s per call, worth it if it catches
      // typos the zero-thinking pass was missing. Capped well below the
      // ~4K/~18s an unbounded budget cost on the sibling validate-script
      // check.
      // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } },
    });
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const raw = result.response.text().trim();
    // Strip markdown fences if present
    const jsonStr = raw.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    let validated: { index: number; text: string; status: "ok" | "fixed" }[];
    try {
      validated = JSON.parse(jsonStr);
    } catch (parseErr) {
      const finishReason = result.response.candidates?.[0]?.finishReason ?? "unknown";
      console.error(`[validate-blocks] Invalid JSON — finishReason=${finishReason}, length=${jsonStr.length} chars. Full response:\n${jsonStr}`);
      throw parseErr;
    }

    let changes = 0;
    const resultBlocks = [...blocks];
    for (const item of validated) {
      const original = textBlocks[item.index];
      if (!original || item.status !== "fixed" || !item.text?.trim()) continue;
      // Gemini never saw the tag (stripped before the prompt was built above),
      // so its reply is always bare spoken text — just re-prepend the tag we
      // held onto, no detection needed.
      const newText = `${original.tag}${item.text.trim()}`;
      resultBlocks[original._idx] = { ...resultBlocks[original._idx], textPayload: newText };
      console.log(`[validate-blocks] Fixed "${original.characterName}" (age/content/grammar) — before: ${JSON.stringify(original.bareText)} | after: ${JSON.stringify(item.text.trim())}`);
      changes++;
    }
    if (changes > 0) console.log(`[validate-blocks] ${changes} block(s) fixed out of ${textBlocks.length} reviewed.`);

    return NextResponse.json({ blocks: resultBlocks, changes });
  } catch (err) {
    console.error("[validate-blocks] error:", err);
    // On any error, return original blocks unchanged — don't block the user
    return NextResponse.json({ blocks, changes: 0 });
  }
}
