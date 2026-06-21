import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import fs from "fs";
import path from "path";

interface RawBlock {
  characterName: string;
  textPayload: string;
}

interface ValidateResponse {
  ok: boolean;
  blocks?: RawBlock[];
  issues?: string[];
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

  const { blocks } = await req.json() as { blocks: RawBlock[] };
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }

  const guidance = readGuidance();

  const systemInstruction = `You are a quality reviewer for NightStory, a children's bedtime audio drama app.
You will receive a script (JSON array of blocks) and must check it against the story guidance below.

${guidance}

Your task:
1. Read every block carefully.
2. Check for any violation of the guidance rules — content boundaries, SFX placement rules,
   mandatory SFX moments, performance tags, language mixing, inappropriate content, etc.
3. If the script is fully compliant (or has only trivial issues you can silently fix):
   Return: { "ok": true, "blocks": [ ...the script, with any minor corrections applied... ] }
4. If the script has real violations that need the author's attention:
   Return: { "ok": false, "issues": [ "Clear description of issue 1", "Clear description of issue 2" ] }
   Issues must be specific and actionable — tell the author exactly what is wrong and where.

Return ONLY the raw JSON object. No markdown fences, no explanation outside the JSON.`;

  const scriptJson = JSON.stringify(
    blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload })),
    null,
    2,
  );

  try {
    const genAI  = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
    const result = await model.generateContent(`Review this script:\n\n${scriptJson}`);
    const _t = result.response.usageMetadata?.totalTokenCount;
    if (_t) trackGemini(_t).catch(() => {});
    const text   = result.response.text().trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: ValidateResponse;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
