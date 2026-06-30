import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { assignVoicesToCharacters } from "@/lib/services/voiceAssignment";
import { trackGemini } from "@/lib/usageTracker";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  // child's age group from profile (e.g. "4-6", "6-8", "8-10")
  childAgeGroup?: string;
  // optional moral lesson(s) to weave into the story
  lesson?: string;
  lessons?: string[];
  // language for story generation (ISO 639-1 code)
  language?: string;
  // content to strictly avoid (fears, sensitivities from child profile)
  avoid?: string;
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

interface RawLessonImpl {
  lesson: string;
  implemented: boolean;
  how: string;
  blockIndices: number[];
}

export interface RawCharacter {
  type: "child" | "adult" | "animal" | "narrator";
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
  title?: string;
  summary: string;
  coverPrompt: string;
  characters?: Record<string, RawCharacter>;
  blocks: RawBlock[];
  lessonImplementations?: RawLessonImpl[];
  scenes?: RawScene[];
}

export interface LessonImplementation {
  lesson: string;
  implemented: boolean;
  how: string;
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

function ageLanguageRules(ageGroup: string): string {
  const lo = parseInt(ageGroup.split(/[-–]/)[0] ?? "5", 10);
  if (lo <= 4) return (
    `LANGUAGE LEVEL: Ages 4–5
- Sentences: max 6–7 words each. One idea per sentence.
- Vocabulary: everyday words only (no metaphors, no abstract concepts).
- Rhythm: short, bouncy, repetitive where it helps memory. Use sound words freely (POP, WHOOSH).
- Emotions: name them directly — "she felt happy", "he was a little scared".
- No subordinate clauses. No irony. No ambiguity.`
  );
  if (lo <= 6) return (
    `LANGUAGE LEVEL: Ages 6–7
- Sentences: 8–12 words. Simple structure, one or two ideas joined by "and" or "but".
- Vocabulary: common words; introduce ONE new word per scene, explained immediately in context.
- Light similes are fine ("as bright as the sun"), but no complex metaphors.
- Emotions can be implied through actions, not just named.
- Keep paragraphs short. Vary pace: short sentences for tension, longer for wonder.`
  );
  if (lo <= 8) return (
    `LANGUAGE LEVEL: Ages 8–9
- Sentences: 10–18 words. Can use subordinate clauses and varied structure.
- Vocabulary: richer words welcome — but always clear from context. Max 2 new words per scene.
- Metaphors and imagery allowed; keep them concrete (nature, familiar objects).
- Characters can have inner thoughts and nuanced feelings.
- Mild plot complexity is fine (a small mystery, a twist). No cliffhangers.`
  );
  return (
    `LANGUAGE LEVEL: Ages 9–10
- Sentences: varied length, 10–22 words. Full narrative voice allowed.
- Vocabulary: near-chapter-book level. Rich descriptive language. Unusual words fine if contextually clear.
- Complex metaphors, imagery, and layered emotions are welcome.
- Plot can carry a mild theme or moral beyond the surface story.
- Writing should feel like a well-crafted short story read aloud, not a simplified tale.`
  );
}

function buildSystemInstruction(guidance: string, durationMinutes: number, childAgeGroup?: string, lesson?: string, lessons?: string[], language?: string, avoid?: string): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));
  const agePart     = childAgeGroup ? `\n\n${ageLanguageRules(childAgeGroup)}` : "";
  // Merge lessons[] and legacy lesson string into one deduplicated list
  const allLessons  = Array.from(new Set([...(lessons ?? []), ...(lesson ? [lesson] : [])])).filter(Boolean);
  const lessonPart  = allLessons.length > 0
    ? `\n\nSTORY VALUES\n------------\nEmbed the following values into the story through concrete actions the protagonist takes. Do NOT state the morals explicitly — let the character's choices show them:\n${allLessons.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n\nAs specified in the script format, include the "lessonImplementations" field in your JSON response.`
    : "";

  const langPart = language && language !== "en"
    ? `\n\nLANGUAGE\n--------\nWrite the ENTIRE story in ${language} (ISO 639-1: "${language}"). All dialogue, narration, SFX labels, and the title must be in this language.`
    : "";

  const avoidPart = avoid
    ? `\n\nCONTENT TO STRICTLY AVOID\n--------------------------\n${avoid}\nThis is a HARD rule. Never include these elements — not even briefly, not even resolved positively. The child has fears or sensitivities around these topics.`
    : "";

  return `${guidance}${lessonPart}${agePart}${langPart}${avoidPart}

RUNTIME TARGETS FOR THIS STORY
-------------------------------
Target duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}
Target word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)
Target blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)

SCENE STRUCTURE (required — output in "scenes" array)
------------------------------------------------------
Divide the story into 3–5 logical scenes based on natural story beats. For each scene output:
  - sceneNumber: integer starting at 1
  - title: 3–5 word evocative label (e.g. "The Moonlit Forest Path")
  - summary: exactly 1 sentence describing what happens in this scene
  - primaryMood: exactly one of — Gentle, Whimsical, Playful, Tense, Soothing, Wondrous, Cozy
  - sfxTags: array of 2–4 short ambient/effect labels (e.g. ["crackling fire", "wind through trees"])
  - lineRange: { "start": <first block index 0-based>, "end": <last block index 0-based, inclusive> }

Scene arc rule: build from an opening mood → engaging peak → low-stimulation soothing resolution (ideal for bedtime).
lineRange indices must be contiguous, non-overlapping, and together cover all blocks from 0 to N-1.`;
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
      systemInstruction: buildSystemInstruction(guidance, durationMinutes, body.childAgeGroup, body.lesson, body.lessons, body.language, body.avoid),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 8192,
        // Disable thinking — story generation is creative, not reasoning; thinking
        // adds 40-80s latency which trips the platform's serverless timeout.
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (err) {
      console.warn("[generate-story] First Gemini attempt failed, retrying once:", err);
      result = await model.generateContent(prompt);
    }
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

    const heroName = body.hero ?? "";
    const characterVoiceMap = assignVoicesToCharacters(raw.blocks ?? [], heroName, body.primaryVoiceId);
    const blocks: ScriptBlock[] = (raw.blocks ?? []).map((block, i) => ({
      id: `blk-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      blockOrder: i + 1,
      characterName: block.characterName,
      assignedVoiceId: characterVoiceMap[block.characterName] ?? body.primaryVoiceId,
      textPayload: block.textPayload,
    }));

    // Annotate blocks with lesson highlights
    const lessonImplementations: LessonImplementation[] = [];
    if (raw.lessonImplementations) {
      for (const impl of raw.lessonImplementations) {
        lessonImplementations.push({ lesson: impl.lesson, implemented: impl.implemented, how: impl.how });
        if (impl.implemented && Array.isArray(impl.blockIndices)) {
          for (const idx of impl.blockIndices) {
            if (idx >= 0 && idx < blocks.length) {
              blocks[idx] = { ...blocks[idx], lessonHighlight: { lesson: impl.lesson, how: impl.how } };
            }
          }
        }
      }
    }

    // Build scenes with computed durations
    const scenes = (raw.scenes ?? []).map((s) => {
      const { start, end } = s.lineRange ?? { start: 0, end: blocks.length - 1 };
      const sceneBlocks = blocks.slice(start, end + 1).filter((b) => b.characterName !== "SFX");
      const words = sceneBlocks.reduce((sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
      return { ...s, estimatedDurationSeconds: Math.ceil(words / (130 / 60)) };
    });

    return NextResponse.json({ blocks, title: raw.title ?? "", summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "", lessonImplementations, characters: raw.characters ?? {}, scenes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
