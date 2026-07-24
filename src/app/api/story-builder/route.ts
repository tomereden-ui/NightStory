import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordGeminiUsage } from "@/lib/serviceUsage";
import fs from "fs";
import path from "path";
import { assignVoicesToCharacters, pickVoiceForCharacterProfile } from "@/lib/services/voiceAssignment";
import { PRESET_VOICES } from "@/config/presetVoices";
import { getEntryTitles } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";
import { estimateWordCount, isWithinLengthTolerance, buildLengthCorrectionNote, buildLengthTargetReminder, splitLongBlocks, detectGeneratedLanguage, fixHebrewLatinMixup, ageLanguageRules, buildChildPersonalizationPart, resolveTitleConflict, type ChildPersonalizationInput } from "@/lib/services/scriptGenerationHelpers";
import { generateScenes } from "@/lib/services/sceneGenerator";
import { LANGUAGE_META } from "@/lib/i18n";
import { buildMoodPromptSpec, buildChosenMoodPromptBlock } from "@/constants/moodUi";
import { HERO_PRESETS, COMPANION_PRESETS, SETTING_PRESETS, MISSION_PRESETS } from "@/constants/storyBuilderUi";
import type { Language } from "@/types";

export const maxDuration = 120;

interface FieldChoice {
  /** A preset id from HERO_PRESETS/COMPANION_PRESETS/SETTING_PRESETS, or "custom". */
  type: string;
  customText?: string;
}

export interface StoryBuilderRequest {
  hero: FieldChoice;
  companion: FieldChoice;
  setting: FieldChoice;
  /** A MISSION_PRESETS id — closed list, no custom text (matches the spec). */
  mission: string;
  /** A single moodUi.ts MOODS id — this flow is single-select, unlike the main SBS wizard's Moods step. */
  mood: string;
  durationMinutes: number;
  language?: string;
  narratorVoiceId?: string;
  /** The active child's own default values (Profile/onboarding) — the
   *  "secondary, character-flavor-only" half of the hierarchical prompt
   *  block below. Never drives the plot; the Mission does that. */
  defaultValues?: string[];
  childAgeGroup?: string;
  avoid?: string;
  gender?: "boy" | "girl" | "other";
  favoriteThemes?: string[];
  favoriteAnimals?: string[];
  preferredFigures?: string[];
  interests?: string;
  notes?: string;
  childName?: string;
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
  title?: string;
  summary: string;
  coverPrompt: string;
  characters?: Record<string, RawCharacter>;
  blocks: RawBlock[];
  scenes?: RawScene[];
}

function readGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
  } catch {
    return "";
  }
}

function resolveFieldText(choice: FieldChoice, presets: { id: string; promptText: string }[]): string {
  if (choice.type === "custom") return choice.customText?.trim() ?? "";
  return presets.find((p) => p.id === choice.type)?.promptText ?? "";
}

// Mission (primary plot driver) + the child's own default values (secondary,
// character-flavor-only) as two explicitly hierarchical prompt blocks —
// giving Gemini an unambiguous priority order instead of listing both as
// equally-weighted "STORY VALUES" the way the main SBS wizard does.
function buildMissionAndFlavorPart(missionDirective: string, defaultValues?: string[]): string {
  const missionPart = `\n\nMISSION (PRIMARY — drives the plot)\n------------------------------------\nThe story's central conflict and events MUST revolve around: ${missionDirective}. This is the main plot driver — every scene should serve this goal.`;
  const flavorPart = defaultValues?.length
    ? `\n\nCHARACTER FLAVOR (secondary — voice and reactions only, never the plot)\n-------------------------------------------------------------------------\n${defaultValues.join(", ")} may lightly color how the hero speaks, reacts, and treats others — but must NEVER introduce a second plot thread or compete with the Mission above for narrative weight.`
    : "";
  return `${missionPart}${flavorPart}`;
}

function buildSystemInstruction(guidance: string, durationMinutes: number, missionDirective: string, moods: string[], language?: string, existingTitles?: string[], defaultValues?: string[], childAgeGroup?: string, avoid?: string, child?: ChildPersonalizationInput): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));
  const missionPart = buildMissionAndFlavorPart(missionDirective, defaultValues);
  const moodPart = buildChosenMoodPromptBlock(moods);
  const agePart = childAgeGroup ? `\n\n${ageLanguageRules(childAgeGroup)}` : "";
  const avoidPart = avoid
    ? `\n\nCONTENT TO STRICTLY AVOID\n--------------------------\n${avoid}\nThis is a HARD rule. Never include these elements — not even briefly, not even resolved positively. The child has fears or sensitivities around these topics.`
    : "";
  const childPart = child ? buildChildPersonalizationPart(child) : "";
  // Always explicit, even for English — see the matching comment in
  // generate-story/route.ts's buildSystemInstruction for why skipping this
  // for "en" was the actual bug (existing-title-list contamination writing
  // Hebrew stories despite English being selected and everything the user
  // typed being in English).
  const langName = language ? (LANGUAGE_META[language as Language]?.label ?? language) : undefined;
  const langPart = langName
    ? `\n\nLANGUAGE\n--------\nWrite all DIALOGUE and NARRATION in ${langName} (ISO 639-1: "${language}"). Character names, the story title, the top-level "summary" field, and each scene's "summary" field (in the scenes array) must also be in this language — these are shown directly to the listener, so they must match the story's language exactly like the dialogue does.\nEXCEPTIONS — keep these fields in English regardless of story language:\n  • SFX textPayload descriptions (sent to ElevenLabs sound generator — non-English produces garbled audio)\n  • visualDescription in the characters map (sent to Imagen avatar generator — non-English produces wrong images)\n  • coverPrompt (sent to Imagen image generator)\n  • The bracketed performance tag at the start of EVERY SINGLE dialogue/narration textPayload (e.g. "[warmly]", "[excited]") — the tag word itself always stays in English, from the first line to the last, with no drift back to the story's language partway through; only the spoken text after the closing "]" switches language.${language === "he" ? `\nHEBREW VOCALIZATION — MANDATORY, no exceptions: write every Hebrew word fully niqqud-ed (with vowel points, ניקוד מלא), e.g. "שָׁלוֹם" not "שלום". This applies to EVERY Hebrew field you output — the dialogue/narration text, the title, the top-level "summary" field, and each scene's "summary" field (in the scenes array) — not just the spoken lines. Unvocalized Hebrew text-to-speech mispronounces words constantly, so this is required for correct audio, not stylistic.` : ""}`
    : "";

  const titleUniquePart = existingTitles?.length
    ? `\n\nTITLE UNIQUENESS\n----------------\nThe following titles already exist in this family's library. You MUST pick a title that does NOT appear in this list (not even as a close variant or reordering of the same words):\n${existingTitles.map((t) => `  - "${t}"`).join("\n")}\nIf your first choice matches any of these, invent a different title.`
    : "";

  return `${guidance}${missionPart}${moodPart}${agePart}${childPart}${langPart}${avoidPart}${titleUniquePart}\n\nRUNTIME TARGETS FOR THIS STORY\n-------------------------------\nTarget duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}\nTarget word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)\nTarget blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)\n\nSCENE STRUCTURE (required — output in "scenes" array)\n------------------------------------------------------\nDivide the story into 3–5 logical scenes based on natural story beats. For each scene output:\n  - sceneNumber: integer starting at 1\n  - title: 3–5 word evocative label (e.g. "The Moonlit Forest Path")\n  - summary: exactly 1 sentence describing what happens in this scene\n  - primaryMood: exactly one of the following moods (choose based on the definition, not just the name):\n${buildMoodPromptSpec()}\n  - sfxTags: array of 2–4 short ambient/effect labels (e.g. ["crackling fire", "wind through trees"])\n  - lineRange: { "start": <first block index 0-based>, "end": <last block index 0-based, inclusive> }\n\nScene arc rule: build from an opening mood → engaging peak → low-stimulation soothing resolution (ideal for bedtime).\nlineRange indices must be contiguous, non-overlapping, and together cover all blocks from 0 to N-1.`;
}

function buildUserPrompt(heroText: string, companionText: string, settingText: string): string {
  return `Story parameters:
HERO      : ${heroText}
COMPANION : ${companionText || "none — the hero goes on this adventure alone"}
SETTING   : ${settingText}

Story rules:
- The hero pursues the mission described in the MISSION section above while exploring the setting.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: StoryBuilderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.hero || !body.companion || !body.setting || !body.mission || !body.mood) {
    return NextResponse.json({ error: "hero, companion, setting, mission, and mood are all required." }, { status: 400 });
  }

  const mission = MISSION_PRESETS.find((m) => m.id === body.mission);
  if (!mission) {
    return NextResponse.json({ error: "Unknown mission." }, { status: 400 });
  }

  const heroText = resolveFieldText(body.hero, HERO_PRESETS);
  const companionText = resolveFieldText(body.companion, COMPANION_PRESETS);
  const settingText = resolveFieldText(body.setting, SETTING_PRESETS);
  if (!heroText || !settingText) {
    return NextResponse.json({ error: "hero and setting must resolve to non-empty text." }, { status: 400 });
  }

  const durationMinutes = body.durationMinutes ?? 5;
  const clampedDuration = Math.min(15, Math.max(1, durationMinutes));
  const guidance = readGuidance();

  let existingTitles: string[] = [];
  try {
    const ctx = await getFamilyContext(req);
    if (ctx) existingTitles = await getEntryTitles(ctx.familyId);
  } catch { /* best-effort */ }

  const systemInstruction = buildSystemInstruction(guidance, clampedDuration, mission.promptDirective, [body.mood], body.language, existingTitles, body.defaultValues, body.childAgeGroup, body.avoid, {
    gender: body.gender,
    favoriteThemes: body.favoriteThemes,
    favoriteAnimals: body.favoriteAnimals,
    preferredFigures: body.preferredFigures,
    interests: body.interests,
    notes: body.notes,
  });
  const userPrompt = buildUserPrompt(heroText, companionText, settingText) + buildLengthTargetReminder(clampedDuration);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 8192,
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const targetWords = Math.round(clampedDuration * 140);
    const targetBlockRange = { min: Math.max(4, Math.round(clampedDuration * 2.5)), max: Math.max(8, Math.round(clampedDuration * 3.6)) };
    let raw: RawResponse | undefined;
    let currentPrompt = userPrompt;
    const maxLengthAttempts = 3;
    const generationStartedAt = Date.now();

    for (let attempt = 1; attempt <= maxLengthAttempts; attempt++) {
      const result = await model.generateContent(currentPrompt);
      const um = result.response.usageMetadata;
      if (um) recordGeminiUsage({ callType: "story_builder_generation" }, { model: "gemini-3.5-flash", inputTokens: um.promptTokenCount, outputTokens: um.candidatesTokenCount, totalTokens: um.totalTokenCount }).catch(() => {});
      const text = result.response.text().trim();
      const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

      try {
        raw = JSON.parse(json);
      } catch {
        console.warn(`[story-builder] Attempt ${attempt} returned non-JSON output, retrying once immediately.`);
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
      console.warn(`[story-builder] Attempt ${attempt}: ${actualWords} words vs target ${targetWords} — retrying with a length correction.`);
      currentPrompt = `${userPrompt}${buildLengthCorrectionNote(actualWords, targetWords, raw!.blocks?.length, targetBlockRange)}`;
    }
    const generationMs = Date.now() - generationStartedAt;

    if (!raw) {
      return NextResponse.json({ error: "Gemini returned non-JSON output after retries." }, { status: 502 });
    }

    if (raw.title && existingTitles.length > 0) {
      raw.title = await resolveTitleConflict(genAI, raw.title, raw.summary ?? "", existingTitles);
    }

    const heroIsChild = !!body.childName && heroText.trim().toLowerCase() === body.childName.trim().toLowerCase();
    const heroVoiceId = heroIsChild && body.gender
      ? pickVoiceForCharacterProfile({ type: "child", gender: body.gender === "boy" ? "male" : body.gender === "girl" ? "female" : "neutral", voicePersona: "playful" })
      : undefined;
    const characterVoiceMap = await assignVoicesToCharacters(raw.blocks ?? [], heroText, heroVoiceId, raw.characters ?? {}, apiKey);
    if (body.narratorVoiceId) {
      const narratorKey = Object.entries(raw.characters ?? {}).find(([, c]) => c.type === "narrator")?.[0];
      characterVoiceMap["Narrator"] = body.narratorVoiceId;
      if (narratorKey) characterVoiceMap[narratorKey] = body.narratorVoiceId;
    }
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

    const detectedLanguage = body.language
      ? body.language
      : await detectGeneratedLanguage(splitBlocks, apiKey);

    const finalBlocks = detectedLanguage === "he"
      ? await fixHebrewLatinMixup(splitBlocks, apiKey)
      : splitBlocks;

    const finalScenes = remappedScenes.length > 0
      ? remappedScenes
      : await generateScenes(finalBlocks, apiKey);

    return NextResponse.json({ blocks: finalBlocks, title: raw.title ?? "", summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "", characters: raw.characters ?? {}, scenes: finalScenes, language: detectedLanguage, generationMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
