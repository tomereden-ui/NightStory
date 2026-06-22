import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import type { ScriptBlock } from "@/types";

interface RawBlock {
  id: string;
  blockOrder: number;
  characterName: string;
  assignedVoiceId: string;
  textPayload: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  const { blocks, instruction, targetBlockId, lessons } = await req.json() as {
    blocks: ScriptBlock[];
    instruction: string;
    targetBlockId?: string;
    lessons?: string[];
  };

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }
  if (!instruction?.trim()) {
    return NextResponse.json({ error: "instruction is required." }, { status: 400 });
  }

  const isTargeted = Boolean(targetBlockId);
  const hasLessons = Array.isArray(lessons) && lessons.length > 0;

  const lessonSection = hasLessons ? `
STORY VALUES TO EMBED:
${lessons!.map((l, i) => `${i + 1}. ${l}`).join("\n")}
Weave these values into the revised script through concrete character actions — do NOT state them explicitly.
After the blocks, include a "lessonImplementations" array (one entry per lesson):
  { "lesson": "<exact name>", "implemented": true|false, "how": "<one sentence on the specific moment>", "blockIndices": [<0-based indices of the 1–2 relevant blocks>] }
` : "";

  const returnFormat = hasLessons
    ? `Return a JSON object: { "blocks": [...same-order array...], "lessonImplementations": [...] }. No markdown fences.`
    : `Return ONLY the raw JSON array. No markdown fences, no explanation.`;

  const systemInstruction = `You are a creative script editor for NightStory, a children's bedtime audio drama app.
You will receive a script as a JSON array and a director's instruction. Apply the instruction faithfully.

RULES:
- Preserve EVERY block's id, blockOrder, characterName, and assignedVoiceId exactly.
- Only modify textPayload where the instruction applies.
- Preserve existing [audio tags] style marks or update them to match the new tone.
- SFX blocks (characterName === "SFX") should only be modified if the instruction explicitly targets sounds.
- Keep language appropriate for children aged 3-10.
- Do not add new blocks or remove existing blocks.
${isTargeted ? `- Only the block with id "${targetBlockId}" should be changed. Leave all other blocks exactly as they are.` : "- Apply the instruction across the whole script as it makes sense."}
${lessonSection}
${returnFormat}`;

  const scriptJson = JSON.stringify(blocks, null, 2);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
    const result = await model.generateContent(
      `Director's instruction: "${instruction.trim()}"\n\nScript:\n${scriptJson}`
    );
    const _t = result.response.usageMetadata?.totalTokenCount;
    if (_t) trackGemini(_t).catch(() => {});
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    if (hasLessons) {
      // Expect { blocks: [...], lessonImplementations: [...] }
      let parsed: { blocks: RawBlock[]; lessonImplementations?: { lesson: string; implemented: boolean; how: string; blockIndices: number[] }[] };
      try {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed.blocks)) throw new Error("blocks not an array");
      } catch {
        return NextResponse.json({ error: "Gemini returned invalid JSON.", raw: text.slice(0, 300) }, { status: 502 });
      }

      const merged: ScriptBlock[] = parsed.blocks.map((r, i) => ({
        ...(blocks[i] ?? {}),
        ...r,
        id: blocks[i]?.id ?? r.id,
        blockOrder: i + 1,
        lessonHighlight: undefined as ScriptBlock["lessonHighlight"],
      }));

      const lessonImplementations: { lesson: string; implemented: boolean; how: string }[] = [];
      for (const impl of parsed.lessonImplementations ?? []) {
        lessonImplementations.push({ lesson: impl.lesson, implemented: impl.implemented, how: impl.how });
        if (impl.implemented && Array.isArray(impl.blockIndices)) {
          for (const idx of impl.blockIndices) {
            if (idx >= 0 && idx < merged.length) {
              merged[idx] = { ...merged[idx], lessonHighlight: { lesson: impl.lesson, how: impl.how } };
            }
          }
        }
      }

      return NextResponse.json({ blocks: merged, lessonImplementations });
    }

    // Standard path — plain array
    let revised: RawBlock[];
    try {
      revised = JSON.parse(text);
      if (!Array.isArray(revised)) throw new Error("Not an array");
    } catch {
      return NextResponse.json({ error: "Gemini returned invalid JSON.", raw: text.slice(0, 300) }, { status: 502 });
    }

    const merged = revised.map((r, i) => ({
      ...(blocks[i] ?? {}),
      ...r,
      id: blocks[i]?.id ?? r.id,
      blockOrder: i + 1,
    }));

    return NextResponse.json({ blocks: merged });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
