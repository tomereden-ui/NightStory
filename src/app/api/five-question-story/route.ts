import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import fs from "fs";
import path from "path";
import { inferCompanionAbility } from "@/utils/inferCompanionAbility";
import { MOOD_LABELS } from "@/constants/bluebellScripts";
import type { StorySeeds } from "@/utils/buildStoryPrompt";
import { assignVoicesToCharacters, assignHebrewVoicesToCharacters } from "@/lib/services/voiceAssignment";
import { PRESET_VOICES } from "@/config/presetVoices";
import { getEntries } from "@/lib/libraryStore";

export interface FiveQuestionStoryRequest {
  seeds: StorySeeds;
  durationMinutes: number;
  language?: string;
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

interface RawCharacter {
  type: "child" | "adult" | "animal" | "narrator";
  gender?: "male" | "female" | "neutral";
  voicePersona?: "warm" | "playful" | "calm" | "dramatic" | "gentle";
  visualDescription: string;
}

interface RawScene {
  sceneNumber: number;
  title: string;
  summary: string;
  primaryMood: string;
  sfxTags: string[];
  lineRange: { start: number; end: number };
}

interface RawResponse {
  summary: string;
  coverPrompt: string;
  characters?: Record<string, RawCharacter>;
  blocks: RawBlock[];
  scenes?: RawScene[];
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

function buildSystemInstruction(guidance: string, durationMinutes: number, language?: string, existingTitles?: string[]): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));
  const langPart = language && language !== "en"
    ? `\n\nLANGUAGE\n--------\nWrite all DIALOGUE and NARRATION in ${language} (ISO 639-1: "${language}"). Character names and the story title must also be in this language.\nEXCEPTIONS — keep these fields in English regardless of story language:\n  • SFX textPayload descriptions (sent to ElevenLabs sound generator — non-English produces garbled audio)\n  • visualDescription in the characters map (sent to Imagen avatar generator — non-English produces wrong images)\n  • coverPrompt (sent to Imagen image generator)`
    : "";

  const titleUniquePart = existingTitles?.length
    ? `\n\nTITLE UNIQUENESS\n----------------\nThe following titles already exist in this family's library. You MUST pick a title that does NOT appear in this list (not even as a close variant or reordering of the same words):\n${existingTitles.map((t) => `  - "${t}"`).join("\n")}\nIf your first choice matches any of these, invent a different title.`
    : "";

  return `${guidance}${langPart}${titleUniquePart}\n\nRUNTIME TARGETS FOR THIS STORY\n-------------------------------\nTarget duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}\nTarget word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)\nTarget blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)\n\nSCENE STRUCTURE (required — output in "scenes" array)\n------------------------------------------------------\nDivide the story into 3–5 logical scenes based on natural story beats. For each scene output:\n  - sceneNumber: integer starting at 1\n  - title: 3–5 word evocative label (e.g. "The Moonlit Forest Path")\n  - summary: exactly 1 sentence describing what happens in this scene\n  - primaryMood: exactly one of — Gentle, Whimsical, Playful, Tense, Soothing, Wondrous, Cozy\n  - sfxTags: array of 2–4 short ambient/effect labels (e.g. ["crackling fire", "wind through trees"])\n  - lineRange: { "start": <first block index 0-based>, "end": <last block index 0-based, inclusive> }\n\nScene arc rule: build from an opening mood → engaging peak → low-stimulation soothing resolution (ideal for bedtime).\nlineRange indices must be contiguous, non-overlapping, and together cover all blocks from 0 to N-1.`;
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fixConflictingTitle(
  genAI: GoogleGenerativeAI,
  title: string,
  summary: string,
  existingTitles: string[]
): Promise<string> {
  const existNorm = new Set(existingTitles.map(normTitle));
  if (!existNorm.has(normTitle(title))) return title;
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 30,
        // @ts-expect-error thinkingConfig valid but not in typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const existList = existingTitles.slice(0, 20).map((t) => `"${t}"`).join(", ");
    const prompt = `The children's story title "${title}" is already in this family's library. Based on this story summary: "${summary.slice(0, 200)}", suggest ONE alternative title. It must NOT be any of: ${existList}. Output ONLY the title, nothing else.`;
    const result = await model.generateContent(prompt);
    const alt = result.response.text().trim().replace(/^["'`]|["'`]$/g, "").trim();
    if (alt && alt.length > 2 && alt.length < 80 && !existNorm.has(normTitle(alt))) return alt;
  } catch { /* ignore */ }
  const SUFFIXES = ["A New Adventure", "A Magical Tale", "The Next Chapter", "A New Journey"];
  for (const sfx of SUFFIXES) {
    const candidate = `${title}: ${sfx}`;
    if (!existNorm.has(normTitle(candidate))) return candidate;
  }
  return `${title} (New)`;
}

function buildUserPrompt(seeds: StorySeeds): string {
  const ability   = inferCompanionAbility(seeds.q3_companion);
  const moodLabel = MOOD_LABELS[seeds.q5_mood] ?? seeds.q5_mood;

  return `Story seeds:
HERO      : ${seeds.q1_hero}
WORLD     : ${seeds.q2_world}
COMPANION : ${seeds.q3_companion}
CHALLENGE : ${seeds.q4_engine}
ENDING MOOD: ${moodLabel}

The companion's special ability (use as the resolution mechanism):
${ability}

Story rules:
- Resolve the challenge through the companion's ability — first imperfectly, then perfectly at the climax
- End with ${seeds.q1_hero} feeling ${moodLabel}`;
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

  let existingTitles: string[] = [];
  try {
    const entries = await getEntries();
    existingTitles = entries.map((e) => e.title).filter(Boolean);
  } catch { /* best-effort */ }

  const systemInstruction = buildSystemInstruction(guidance, clampedDuration, body.language, existingTitles);
  const userPrompt = buildUserPrompt(seeds);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    const result = await model.generateContent(userPrompt);
    const _t = result.response.usageMetadata?.totalTokenCount;
    if (_t) trackGemini(_t).catch(() => {});
    const text = result.response.text().trim();

    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let raw: RawResponse;
    try {
      raw = JSON.parse(json);
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    const assignVoices = body.language === "he" ? assignHebrewVoicesToCharacters : assignVoicesToCharacters;
    const characterVoiceMap = assignVoices(raw.blocks ?? [], seeds.q1_hero, undefined, raw.characters ?? {});
    const blocks = (raw.blocks ?? []).map((block, i) => ({
      id: `blk-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      blockOrder: i + 1,
      characterName: block.characterName,
      assignedVoiceId: characterVoiceMap[block.characterName] ?? PRESET_VOICES[0].id,
      textPayload: block.textPayload,
    }));

    const scenes = (raw.scenes ?? []).map((s) => {
      const { start, end } = s.lineRange ?? { start: 0, end: blocks.length - 1 };
      const sceneBlocks = blocks.slice(start, end + 1).filter((b) => b.characterName !== "SFX");
      const words = sceneBlocks.reduce((sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
      return { ...s, estimatedDurationSeconds: Math.ceil(words / (130 / 60)) };
    });

    return NextResponse.json({ blocks, summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "", characters: raw.characters ?? {}, scenes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
