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

interface RawResponse {
  summary: string;
  coverPrompt: string;
  blocks: RawBlock[];
}

// ─── Load external story guidance ────────────────────────────────────────────

function readGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
  } catch {
    return "";
  }
}

// ─── System instruction — guidance file + runtime numbers only ────────────────

function buildSystemInstruction(guidance: string, durationMinutes: number): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));

  return `${guidance}

RUNTIME TARGETS FOR THIS STORY
-------------------------------
Target duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}
Target word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)
Target blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)`;
}

// ─── User prompt — story description only ────────────────────────────────────

function buildUserPrompt(body: GenerateStoryRequest): string {
  if (body.mode === "prompt" && body.promptText) {
    return `Story description:\n${body.promptText}`;
  }
  const parts: string[] = [];
  if (body.hero)    parts.push(`Main character: ${body.hero}`);
  if (body.setting) parts.push(`Setting: ${body.setting}`);
  if (body.plot)    parts.push(`Plot: ${body.plot}`);
  return parts.join("\n");
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
  const prompt = buildUserPrompt(body);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemInstruction(guidance, durationMinutes),
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let raw: RawResponse;
    try {
      raw = JSON.parse(json);
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    const heroName = body.hero ?? "";
    const blocks = (raw.blocks ?? []).map((block, i) => ({
      id: `blk-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      blockOrder: i + 1,
      characterName: block.characterName,
      assignedVoiceId: assignVoice(block.characterName, body.primaryVoiceId, heroName),
      textPayload: block.textPayload,
    }));

    return NextResponse.json({ blocks, summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
