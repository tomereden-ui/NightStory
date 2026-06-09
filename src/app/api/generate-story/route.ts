import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

function buildPrompt(body: GenerateStoryRequest): string {
  const base =
    "Generate a children's bedtime story of approximately 5 minutes (around 650 words). " +
    "The story should be gentle, imaginative, and suitable for ages 4–8.\n\n";

  let definition = "";

  if (body.mode === "prompt" && body.promptText) {
    definition = `Story description:\n${body.promptText}`;
  } else {
    const parts: string[] = [];
    if (body.hero)    parts.push(`Main character: ${body.hero}`);
    if (body.setting) parts.push(`Setting: ${body.setting}`);
    if (body.plot)    parts.push(`Plot: ${body.plot}`);
    definition = parts.join("\n");
  }

  const format =
    "\n\nReturn the story as a JSON array of script blocks. Each block must have exactly two fields:\n" +
    '- "characterName": use "Narrator" for narration, or the character\'s actual name for spoken dialogue\n' +
    '- "textPayload": the text content (narrator text or spoken line, no quotation marks around the whole payload)\n\n' +
    "Aim for 6–12 blocks total. Include at least one dialogue block per main character.\n" +
    "Return ONLY the raw JSON array — no markdown fences, no explanation, nothing else.";

  return base + definition + format;
}

function assignVoice(characterName: string, primaryVoiceId: string, heroName: string): string {
  const name = characterName.toLowerCase();
  if (name === "narrator") return "v1";
  // if the block character matches the hero name, use the user's chosen voice
  if (heroName && name.includes(heroName.toLowerCase().slice(0, 5))) return primaryVoiceId;
  // secondary characters alternate between v3 and v4
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

  const prompt = buildPrompt(body);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip optional markdown fences Gemini sometimes adds despite instructions
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
