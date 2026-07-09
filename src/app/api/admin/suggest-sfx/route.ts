import { NextRequest, NextResponse } from "next/server";
import { geminiPost } from "@/lib/geminiClient";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface Block { characterName: string; textPayload: string; }
interface SfxSuggestion { afterBlockIndex: number; description: string; reason: string; }

function readGuidanceSfx(): string {
  try {
    const full = fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
    const idx = full.indexOf("SOUND EFFECTS");
    return idx >= 0 ? full.slice(idx, idx + 2000) : "";
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  const { blocks, title } = await req.json() as { blocks: Block[]; title?: string };
  if (!Array.isArray(blocks) || !blocks.length) {
    return NextResponse.json({ suggestions: [] });
  }

  const sfxGuidance = readGuidanceSfx();

  const blocksText = blocks
    .map((b, i) => `[${i}] ${b.characterName}: ${b.textPayload}`)
    .join("\n");

  const prompt = `You are a sound designer for a children's audio drama app called NightStory.
${sfxGuidance ? `\nSFX RULES FROM OUR STORY GUIDANCE:\n${sfxGuidance}\n` : ""}
Story title: "${title ?? "Untitled"}"

Script blocks (each prefixed with its 0-based index):
${blocksText}

Your task: suggest where SFX should be inserted to bring this story to life.
For each suggestion, specify which block index the SFX should appear BEFORE (i.e. afterBlockIndex = the block it precedes minus 1, or -1 if it goes before the very first block).

Rules:
- Suggest 3–6 SFX total (including one ambient/opening sound)
- Never place two SFX consecutively (at least one spoken block between each)
- Keep all sounds warm, gentle, or magical — nothing harsh or scary
- Opening SFX should set the scene (ambient sound)
- SFX descriptions must be concrete and producible (e.g. "soft wind chimes tinkling gently")

Respond ONLY with valid JSON (no markdown):
{ "suggestions": [ { "afterBlockIndex": number, "description": string, "reason": string } ] }
- afterBlockIndex: -1 means before block 0, 0 means before block 1, etc.
- description: vivid ElevenLabs SFX prompt (1-2 sentences)
- reason: why this SFX here (under 10 words)`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text as string) as { suggestions: SfxSuggestion[] };
    return NextResponse.json({ suggestions: parsed.suggestions ?? [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
