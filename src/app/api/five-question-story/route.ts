import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { inferCompanionAbility } from "@/utils/inferCompanionAbility";
import { MOOD_LABELS } from "@/constants/bluebellScripts";
import type { StorySeeds } from "@/utils/buildStoryPrompt";

export interface FiveQuestionStoryRequest {
  seeds: StorySeeds;
  durationMinutes: number;
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

function readGuidance(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "config", "story-guidance.txt"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

function buildSystemInstruction(guidance: string, durationMinutes: number): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks = Math.max(8, Math.round(durationMinutes * 3.6));

  return `${guidance}

RUNTIME TARGET
--------------
The final audio run-time must be exactly ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}.
Aim for ${targetWords - 60}–${targetWords + 60} total spoken words across all blocks.
Use ${minBlocks}–${maxBlocks} script blocks to fill the full runtime.
Balance dialogue evenly between the hero, the companion, and the Narrator.`;
}

function buildUserPrompt(seeds: StorySeeds): string {
  const ability = inferCompanionAbility(seeds.q3_companion);
  const moodLabel = MOOD_LABELS[seeds.q5_mood] ?? seeds.q5_mood;

  return `Generate a children's audio drama script using these 5 seeds:

HERO: ${seeds.q1_hero}
WORLD: ${seeds.q2_world}
COMPANION: ${seeds.q3_companion}
DRAMATIC ENGINE (the central challenge): ${seeds.q4_engine}
RESOLUTION MOOD: ${moodLabel}

COMPANION'S SPECIAL ABILITY — use this as the exact mechanism that resolves the dramatic engine:
${ability}

CHARACTERS TO USE:
- Narrator (narration only)
- ${seeds.q1_hero} (the hero — all their lines use their exact name)
- ${seeds.q3_companion} (the companion — use their exact name or description)
- Add 1–2 minor supporting characters only if the story naturally calls for them

STORY RULES:
- Resolve the challenge (${seeds.q4_engine}) through cleverness or kindness, never force
- The companion's special ability must appear twice: imperfectly first, then perfectly at the climax
- End with ${seeds.q1_hero} feeling ${moodLabel}
- Every line must begin with a performance tag like [excited], [whispering], [warmly], etc.

Return ONLY the raw JSON array of script blocks. No markdown fences, no explanation.`;
}

function assignVoice(characterName: string, heroName: string): string {
  const n = characterName.toLowerCase();
  if (n === "narrator") return "v1";
  if (heroName && n.includes(heroName.toLowerCase().slice(0, 4))) return "v2";
  return "v3";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: FiveQuestionStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { seeds, durationMinutes = 5 } = body;
  if (!seeds?.q1_hero || !seeds?.q2_world || !seeds?.q3_companion || !seeds?.q4_engine || !seeds?.q5_mood) {
    return NextResponse.json({ error: "All 5 seeds are required." }, { status: 400 });
  }

  const clampedDuration = Math.min(15, Math.max(1, durationMinutes));
  const guidance = readGuidance();
  const systemInstruction = buildSystemInstruction(guidance, clampedDuration);
  const userPrompt = buildUserPrompt(seeds);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    const result = await model.generateContent(userPrompt);
    const text = result.response.text().trim();

    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let raw: RawBlock[];
    try {
      raw = JSON.parse(json);
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    const blocks = raw.map((block, i) => ({
      id: `blk-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      blockOrder: i + 1,
      characterName: block.characterName,
      assignedVoiceId: assignVoice(block.characterName, seeds.q1_hero),
      textPayload: block.textPayload,
    }));

    return NextResponse.json({ blocks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
