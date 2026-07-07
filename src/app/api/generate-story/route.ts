import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { assignVoicesToCharacters } from "@/lib/services/voiceAssignment";
import { trackGemini } from "@/lib/usageTracker";
import { getEntries } from "@/lib/libraryStore";
import { estimateWordCount, isWithinLengthTolerance, buildLengthCorrectionNote, resolveTitleConflict, splitLongBlocks, detectGeneratedLanguage } from "@/lib/services/scriptGenerationHelpers";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  // user's chosen default narrator voice — always wins for the "Narrator" character
  narratorVoiceId?: string;
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

function buildSystemInstruction(guidance: string, durationMinutes: number, childAgeGroup?: string, lesson?: string, lessons?: string[], language?: string, avoid?: string, existingTitles?: string[]): string {
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
    ? `\n\nLANGUAGE\n--------\nWrite all DIALOGUE and NARRATION in ${language} (ISO 639-1: "${language}"). Character names, the story title, the top-level "summary" field, and each scene's "summary" field (in the scenes array) must also be in this language — these are shown directly to the listener, so they must match the story's language exactly like the dialogue does.\nEXCEPTIONS — keep these fields in English regardless of story language:\n  • SFX textPayload descriptions (sent to ElevenLabs sound generator — non-English produces garbled audio)\n  • visualDescription in the characters map (sent to Imagen avatar generator — non-English produces wrong images)\n  • coverPrompt (sent to Imagen image generator)\n  • The bracketed performance tag at the start of EVERY SINGLE dialogue/narration textPayload (e.g. "[warmly]", "[excited]") — the tag word itself always stays in English, from the first line to the last, with no drift back to the story's language partway through; only the spoken text after the closing "]" switches language. Example: "[warmly] בְּלֵב שְׁכוּנָה מְלֵאָה בְּצִבְעִים וְקולוֹת, גָּר רוֹן הַקָּטָן." NOT "[חַמִּים] ...".${language === "he" ? `\nHEBREW VOCALIZATION — MANDATORY, no exceptions: write every Hebrew word fully niqqud-ed (with vowel points, ניקוד מלא), e.g. "שָׁלוֹם" not "שלום". This applies to EVERY Hebrew field you output — the dialogue/narration text, the title, the top-level "summary" field, and each scene's "summary" field (in the scenes array) — not just the spoken lines. The top-level "summary" is shown to parents browsing the library and is also read by some screen readers, so it needs niqqud exactly as much as the script itself does. Unvocalized Hebrew text-to-speech mispronounces words constantly, so this is required for correct audio, not stylistic.` : ""}`
    : "";

  const avoidPart = avoid
    ? `\n\nCONTENT TO STRICTLY AVOID\n--------------------------\n${avoid}\nThis is a HARD rule. Never include these elements — not even briefly, not even resolved positively. The child has fears or sensitivities around these topics.`
    : "";

  const titleUniquePart = existingTitles?.length
    ? `\n\nTITLE UNIQUENESS\n----------------\nThe following titles already exist in this family's library. You MUST pick a title that does NOT appear in this list (not even as a close variant or reordering of the same words):\n${existingTitles.map((t) => `  - "${t}"`).join("\n")}\nIf your first choice matches any of these, invent a different title.`
    : "";

  return `${guidance}${lessonPart}${agePart}${langPart}${avoidPart}${titleUniquePart}\n\nRUNTIME TARGETS FOR THIS STORY\n-------------------------------\nTarget duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}\nTarget word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)\nTarget blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)\n\nSCENE STRUCTURE (required — output in "scenes" array)\n------------------------------------------------------\nDivide the story into 3–5 logical scenes based on natural story beats. For each scene output:\n  - sceneNumber: integer starting at 1\n  - title: 3–5 word evocative label (e.g. "The Moonlit Forest Path")\n  - summary: exactly 1 sentence describing what happens in this scene\n  - primaryMood: exactly one of — Gentle, Whimsical, Playful, Tense, Soothing, Wondrous, Cozy\n  - sfxTags: array of 2–4 short ambient/effect labels (e.g. ["crackling fire", "wind through trees"])\n  - lineRange: { "start": <first block index 0-based>, "end": <last block index 0-based, inclusive> }\n\nScene arc rule: build from an opening mood → engaging peak → low-stimulation soothing resolution (ideal for bedtime).\nlineRange indices must be contiguous, non-overlapping, and together cover all blocks from 0 to N-1.`;
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

  let existingTitles: string[] = [];
  try {
    const entries = await getEntries();
    existingTitles = entries.map((e) => e.title).filter(Boolean);
  } catch { /* best-effort — don't block generation if DB is unreachable */ }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemInstruction(guidance, durationMinutes, body.childAgeGroup, body.lesson, body.lessons, body.language, body.avoid, existingTitles),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 8192,
        // Disable thinking — story generation is creative, not reasoning; thinking
        // adds 40-80s latency which trips the platform's serverless timeout.
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Gemini often doesn't hit the target word count on the first try (a
    // story requested at 2 minutes has come out well under a minute) —
    // check the actual output and, if it's off by more than 20%, ask Gemini
    // to expand/shorten and regenerate rather than silently accepting it.
    const targetWords = Math.round(durationMinutes * 140);
    let raw: RawResponse | undefined;
    let currentPrompt = prompt;
    const maxLengthAttempts = 3;

    for (let attempt = 1; attempt <= maxLengthAttempts; attempt++) {
      let result;
      try {
        result = await model.generateContent(currentPrompt);
      } catch (err) {
        console.warn(`[generate-story] Gemini attempt ${attempt} failed, retrying once:`, err);
        result = await model.generateContent(currentPrompt);
      }
      const _t = result.response.usageMetadata?.totalTokenCount;
      if (_t) trackGemini(_t).catch(() => {});
      const text = result.response.text().trim();
      const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

      try {
        raw = JSON.parse(json);
      } catch {
        // Malformed JSON is a separate failure mode from being off the word-count
        // target, so it gets its own immediate retry rather than just eating into
        // the length-correction budget above -- otherwise a story that needed 2
        // length corrections had zero attempts left to recover from a garbled
        // final response, and the whole request failed outright.
        console.warn(`[generate-story] Attempt ${attempt} returned non-JSON output, retrying once immediately.`);
        try {
          const retryResult = await model.generateContent(currentPrompt);
          const retryText = retryResult.response.text().trim();
          const retryJson = retryText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
          raw = JSON.parse(retryJson);
        } catch {
          if (attempt === maxLengthAttempts) {
            return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
          }
          continue;
        }
      }

      const actualWords = estimateWordCount(raw!.blocks ?? []);
      if (isWithinLengthTolerance(actualWords, targetWords) || attempt === maxLengthAttempts) break;
      console.warn(`[generate-story] Attempt ${attempt}: ${actualWords} words vs target ${targetWords} — retrying with a length correction.`);
      currentPrompt = `${prompt}${buildLengthCorrectionNote(actualWords, targetWords)}`;
    }

    if (!raw) {
      return NextResponse.json({ error: "Gemini returned non-JSON output after retries." }, { status: 502 });
    }

    // Fix title conflict if needed (small Gemini call, not a full regeneration)
    if (raw.title && existingTitles.length > 0) {
      raw.title = await resolveTitleConflict(genAI, raw.title, raw.summary ?? "", existingTitles);
    }

    const heroName = body.hero ?? "";
    // Gemini's preset pool now voices every language, so casting no longer
    // needs a separate Hebrew EL-voice path.
    const characterVoiceMap = assignVoicesToCharacters(raw.blocks ?? [], heroName, body.primaryVoiceId, raw.characters ?? {});
    // The user's default narrator voice always wins for the narrator — nature-
    // based casting would otherwise assign it something else from the moment
    // the story is generated, visible immediately in Studio's Cast section.
    // The guidance file has Gemini translate "Narrator" into the story's own
    // language (e.g. "קריין" in Hebrew), so the literal key "Narrator" won't
    // match for non-English stories — look up the actual key via the
    // characters map's type field instead, which survives translation.
    if (body.narratorVoiceId) {
      const narratorKey = Object.entries(raw.characters ?? {}).find(([, c]) => c.type === "narrator")?.[0];
      characterVoiceMap["Narrator"] = body.narratorVoiceId;
      if (narratorKey) characterVoiceMap[narratorKey] = body.narratorVoiceId;
    }
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

    // Build scenes with computed durations (against the pre-split blocks, so
    // lineRange still matches indices 1:1 at this point)
    const scenes = (raw.scenes ?? []).map((s) => {
      const { start, end } = s.lineRange ?? { start: 0, end: blocks.length - 1 };
      const sceneBlocks = blocks.slice(start, end + 1).filter((b) => b.characterName !== "SFX");
      const words = sceneBlocks.reduce((sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
      return { ...s, estimatedDurationSeconds: Math.ceil(words / (130 / 60)) };
    });

    // Re-chunk any block Gemini wrote too long (bad for TTS pacing) into
    // several shorter consecutive blocks, then remap scenes' lineRange
    // against the now-longer block array.
    const { blocks: splitBlocks, indexMap } = splitLongBlocks(blocks, 30);
    const remappedScenes = scenes.map((s) => {
      const { start, end } = s.lineRange ?? { start: 0, end: blocks.length - 1 };
      return {
        ...s,
        lineRange: {
          start: indexMap[start]?.[0] ?? start,
          end: indexMap[end]?.[1] ?? end,
        },
      };
    });

    // If an explicit non-English language was requested, the LANGUAGE section
    // above told Gemini to write in it and it reliably does -- trust it. When
    // no language was given (or it's "en", the default that adds no explicit
    // instruction), story-guidance.txt's own auto-detect-from-prompt behavior
    // may have produced something other than English, so detect what Gemini
    // actually wrote rather than assume the request's own language holds.
    const detectedLanguage = (body.language && body.language !== "en")
      ? body.language
      : await detectGeneratedLanguage(splitBlocks, apiKey);

    return NextResponse.json({ blocks: splitBlocks, title: raw.title ?? "", summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "", lessonImplementations, characters: raw.characters ?? {}, scenes: remappedScenes, language: detectedLanguage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
