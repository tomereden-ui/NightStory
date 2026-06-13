import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export interface GenerateStoryRequest {
  mode: "wizard" | "prompt";
  // wizard fields
  hero?: string;
  setting?: string;
  plot?: string;
  // prompt tab
  promptText?: string;
  // primary voice id chosen by user (v1–v4)
  primaryVoiceId: string;
  // desired audio length in minutes (1–15)
  durationMinutes?: number;
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

// ─── Load external story guidance ────────────────────────────────────────────

function readGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
  } catch {
    return "";
  }
}

// ─── System instruction ───────────────────────────────────────────────────────

function buildSystemInstruction(guidance: string, durationMinutes: number): string {
  const targetWords = Math.round(durationMinutes * 140);
  const wordRange   = `${targetWords - 60}–${targetWords + 60}`;
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));

  return `${guidance}

RUNTIME TARGETS FOR THIS STORY
-------------------------------
- Target duration: ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}
- Target spoken word count: ${wordRange} words (speech blocks only; SFX blocks do not count)
- Target block count: ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)
- Characters: Narrator + exactly 2 named characters (child or animal)

LANGUAGE RULE
-------------
Determine the story language from the PROSE TEXT of the user's description — sentences and plot
descriptions. Character names are proper nouns and must NOT be used to infer language.
If the prose is in English → write entirely in English.
If the prose is in Hebrew → write entirely in Hebrew.
Never mix languages.`;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(body: GenerateStoryRequest): string {
  let storyDef = "";
  if (body.mode === "prompt" && body.promptText) {
    storyDef = `\n\nStory description:\n${body.promptText}`;
  } else {
    const parts: string[] = [];
    if (body.hero)    parts.push(`Main character: ${body.hero}`);
    if (body.setting) parts.push(`Setting: ${body.setting}`);
    if (body.plot)    parts.push(`Plot: ${body.plot}`);
    if (parts.length) storyDef = "\n\n" + parts.join("\n");
  }

  const format =
    `\n\nReturn the story as a JSON array of script blocks. Each block has exactly two fields:\n` +
    `- "characterName": "Narrator" (in the story language) for narration, the character's name for dialogue, or "SFX" for sound effect blocks\n` +
    `- "textPayload": spoken text with performance tags for speech blocks (e.g., "[excited] Wow!"), or SFX descriptor for SFX blocks (e.g., "[SFX: gentle ocean waves | 5s]")\n\n` +
    `SFX blocks use this exact format: [SFX: {vivid natural-language description} | {duration}s]\n` +
    `Follow the SFX placement and quantity rules from the system guidance exactly.\n\n` +
    `Return ONLY the raw JSON array — no markdown fences, no explanation, nothing else.`;

  return storyDef + format;
}

function assignVoice(characterName: string, primaryVoiceId: string, heroName: string): string {
  const name = characterName.toLowerCase();
  if (name === "narrator") return "v1";
  if (heroName && name.includes(heroName.toLowerCase().slice(0, 5))) return primaryVoiceId;
  return "v3";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: GenerateStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const durationMinutes = Math.min(15, Math.max(1, body.durationMinutes ?? 5));
  const guidance = readGuidance();
  const prompt = buildPrompt(body);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemInstruction(guidance, durationMinutes),
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let raw: RawBlock[];
    try {
      raw = JSON.parse(json);
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    const heroName = body.hero ?? "";
    const blocks = raw.map((block, i) => ({
      id: `blk-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      blockOrder: i + 1,
      characterName: block.characterName,
      assignedVoiceId: assignVoice(block.characterName, body.primaryVoiceId, heroName),
      textPayload: block.textPayload,
    }));

    return NextResponse.json({ blocks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
