import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordGeminiUsage } from "@/lib/serviceUsage";
import fs from "fs";
import path from "path";

interface RawBlock {
  characterName: string;
  textPayload: string;
}

function readGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  const { blocks, storyId } = await req.json() as { blocks: RawBlock[]; storyId?: string };
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }

  const guidance = readGuidance();

  // Gemini returns ONLY the blocks it changed (by index) instead of echoing
  // the complete corrected script — on a clean script (the common case,
  // since input here was usually just generated against the same guidance)
  // that collapses output from ~2.5K tokens (~12s of pure output generation
  // for a 40-block story, measured) to near-zero. The route reassembles the
  // full corrected array below, so callers still get the same {ok, blocks,
  // issues} response shape as before.
  const systemInstruction = `You are a quality reviewer for NightStory, a children's bedtime audio drama app.
You will receive a script as a JSON array of blocks, each with exactly two fields: "characterName" and "textPayload". Array positions are zero-indexed.
Check it against the story guidance below.

${guidance}

Your task:
1. Read every block carefully against the guidance rules.
2. Identify real violations and write a corrected textPayload for each violating block, preserving the story's intent. Only flag genuine violations — never rewrite for stylistic preference.
3. ALWAYS return this EXACT JSON shape (no other keys):
{
  "ok": true,
  "fixes": [
    { "index": 3, "textPayload": "[warmly] The corrected line text..." }
  ],
  "issues": []
}

Rules for the response:
- "ok" is true if the script was already clean, false if you found real violations.
- "fixes" contains ONLY blocks you actually changed, identified by their zero-based index in the input array. Empty array [] if the script is already clean. Do NOT echo unchanged blocks — never include a block whose text you did not modify.
- "issues" is an array of plain strings describing what was wrong and what you changed. Empty array [] if nothing needed fixing.

Return ONLY the raw JSON object. No markdown fences, no explanation outside the JSON.`;

  const scriptJson = JSON.stringify(
    blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload })),
    null,
    2,
  );

  const startedAt = Date.now();
  try {
    const genAI  = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.2,
        // Enough for dozens of fixed blocks; a script needing more than that
        // is broken input, and truncation degrades to a 502 the callers
        // already handle (admin falls back to the unpolicy-checked script).
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        // Reviewing against explicit written rules needs no reasoning chain —
        // thinking was adding a measured ~18s (and up to 4K thought tokens)
        // per call on top of the response itself.
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(`Review this script:\n\n${scriptJson}`);
    const um = result.response.usageMetadata;
    if (um) recordGeminiUsage({ callType: "content_review", storyId }, { model: "gemini-3.5-flash", inputTokens: um.promptTokenCount, outputTokens: um.candidatesTokenCount, totalTokens: um.totalTokenCount }).catch(() => {});
    const text   = result.response.text().trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: { ok?: boolean; fixes?: { index?: number; textPayload?: string }[]; issues?: string[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const finishReason = result.response.candidates?.[0]?.finishReason ?? "unknown";
      console.error(`[validate-script] Invalid JSON — finishReason=${finishReason}, length=${text.length} chars`);
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    // Reassemble the full corrected script so the response shape callers
    // depend on ({ok, blocks, issues}) is unchanged.
    const corrected = blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload }));
    let applied = 0;
    for (const fix of parsed.fixes ?? []) {
      if (typeof fix.index === "number" && fix.index >= 0 && fix.index < corrected.length && typeof fix.textPayload === "string" && fix.textPayload.trim()) {
        corrected[fix.index] = { ...corrected[fix.index], textPayload: fix.textPayload };
        applied++;
      }
    }

    return NextResponse.json({
      ok: parsed.ok !== false && applied === 0,
      blocks: corrected,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      ms: Date.now() - startedAt,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
