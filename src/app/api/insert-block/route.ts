import { NextRequest, NextResponse } from "next/server";
import type { ScriptBlock } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";

function makeId() {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let blocks: ScriptBlock[], afterIndex: number, instruction: string, summary: string | undefined;
  try {
    ({ blocks, afterIndex, instruction, summary } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!instruction?.trim()) return NextResponse.json({ error: "instruction required" }, { status: 400 });

  // Voice map: characterName → voiceId (from existing blocks)
  const characterVoiceMap: Record<string, string> = {};
  for (const b of blocks) {
    if (b.characterName !== "SFX" && !characterVoiceMap[b.characterName]) {
      characterVoiceMap[b.characterName] = b.assignedVoiceId;
    }
  }
  const existingChars = Object.keys(characterVoiceMap);
  const fallbackVoiceId = blocks.find((b) => b.characterName !== "SFX")?.assignedVoiceId ?? "";

  // Grab 2 blocks before and after insertion point for context
  const contextBefore = blocks.slice(Math.max(0, afterIndex - 2), afterIndex + 1);
  const contextAfter  = blocks.slice(afterIndex + 1, afterIndex + 3);

  const systemInstruction = `You are a children's bedtime story script editor. Generate 1-2 new script blocks to insert at the marked position.

Story: ${summary ?? "a magical bedtime adventure"}
Existing characters: ${existingChars.join(", ") || "Narrator"}

Rules:
- Use existing character names for dialogue/narration
- Use characterName "SFX" for sound effects (textPayload = sound description, e.g. "a soft chime fades gently")
- Keep the tone gentle, warm, and age-appropriate for children
- Return ONLY a raw JSON array. No markdown, no explanation.

Each element: { "characterName": string, "textPayload": string }`;

  const userMessage = [
    contextBefore.length ? `Context before:\n${contextBefore.map((b) => `[${b.characterName}]: ${b.textPayload}`).join("\n")}` : "",
    `\n>>> Insert here: "${instruction.trim()}" <<<\n`,
    contextAfter.length ? `Context after:\n${contextAfter.map((b) => `[${b.characterName}]: ${b.textPayload}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");

  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
    });

    const raw = geminiText(data);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{ characterName: string; textPayload: string }>;

    const newBlocks: ScriptBlock[] = parsed
      .filter((b) => b.characterName && b.textPayload)
      .map((b) => ({
        id: makeId(),
        blockOrder: 0,
        characterName: b.characterName,
        assignedVoiceId: characterVoiceMap[b.characterName] ?? fallbackVoiceId,
        textPayload: b.textPayload,
      }));

    if (newBlocks.length === 0) {
      return NextResponse.json({ error: "Gemini returned no blocks" }, { status: 502 });
    }

    return NextResponse.json({ newBlocks });
  } catch (err) {
    console.error("[InsertBlock] Error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
