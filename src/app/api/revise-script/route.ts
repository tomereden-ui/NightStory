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

  const { blocks, instruction, targetBlockId } = await req.json() as {
    blocks: ScriptBlock[];
    instruction: string;
    targetBlockId?: string;
  };

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }
  if (!instruction?.trim()) {
    return NextResponse.json({ error: "instruction is required." }, { status: 400 });
  }

  const isTargeted = Boolean(targetBlockId);

  const systemInstruction = `You are a creative script editor for NightStory, a children's bedtime audio drama app.
You will receive a script as a JSON array and a director's instruction. Apply the instruction faithfully.

RULES:
- Return ONLY a JSON array of all blocks, in the same order.
- Preserve EVERY block's id, blockOrder, characterName, and assignedVoiceId exactly.
- Only modify textPayload where the instruction applies.
- Preserve existing [audio tags] style marks or update them to match the new tone.
- SFX blocks (characterName === "SFX") should only be modified if the instruction explicitly targets sounds.
- Keep language appropriate for children aged 3-10.
- Do not add new blocks or remove existing blocks.
${isTargeted ? `- Only the block with id "${targetBlockId}" should be changed. Leave all other blocks exactly as they are.` : "- Apply the instruction across the whole script as it makes sense."}

Return ONLY the raw JSON array. No markdown fences, no explanation.`;

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

    let revised: RawBlock[];
    try {
      revised = JSON.parse(text);
      if (!Array.isArray(revised)) throw new Error("Not an array");
    } catch {
      return NextResponse.json({ error: "Gemini returned invalid JSON.", raw: text.slice(0, 300) }, { status: 502 });
    }

    // Restore any fields Gemini dropped
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
