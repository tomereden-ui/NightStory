import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordGeminiUsage } from "@/lib/serviceUsage";
import fs from "fs";
import path from "path";
import { inferCompanionAbility } from "@/utils/inferCompanionAbility";
import { MOOD_LABELS } from "@/constants/lunaScripts";
import type { StorySeeds } from "@/utils/buildStoryPrompt";
import { assignVoicesToCharacters, pickVoiceForCharacterProfile } from "@/lib/services/voiceAssignment";
import { PRESET_VOICES } from "@/config/presetVoices";
import { getEntryTitles } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";
import { estimateWordCount, isWithinLengthTolerance, buildLengthCorrectionNote, buildLengthTargetReminder, splitLongBlocks, detectGeneratedLanguage, fixHebrewLatinMixup, ageLanguageRules, buildChildPersonalizationPart, resolveTitleConflict, type ChildPersonalizationInput } from "@/lib/services/scriptGenerationHelpers";
import { generateScenes } from "@/lib/services/sceneGenerator";
import { LANGUAGE_META } from "@/lib/i18n";
import { buildMoodPromptSpec } from "@/constants/moodUi";
import type { Language } from "@/types";

export const maxDuration = 120;

export interface FiveQuestionStoryRequest {
  seeds: StorySeeds;
  durationMinutes: number;
  language?: string;
  // user's chosen default narrator voice — always wins for the "Narrator" character
  narratorVoiceId?: string;
  // the active child's default values (Profile/onboarding) — woven in
  // the same way generate-story's STORY VALUES section does
  lessons?: string[];
  // remaining child-profile fields — this route previously ignored all of
  // these (age, avoid, gender, themes, animals, figures, interests, notes),
  // so the wizard's generation never adjusted to the real active child at all
  childAgeGroup?: string;
  avoid?: string;
  gender?: "boy" | "girl" | "other";
  favoriteThemes?: string[];
  favoriteAnimals?: string[];
  preferredFigures?: string[];
  interests?: string;
  notes?: string;
  // The active child's own name — compared against seeds.q1_hero to detect
  // "the hero IS the child" (Q1's "your own name" option defaults the hero
  // name to exactly this). Used to cast the hero's voice by the child's real
  // gender instead of a fixed default, and to use the child's own photo as
  // the hero's avatar instead of a generic bank match.
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
    return fs.readFileSync(
      path.join(process.cwd(), "config", "story-guidance.txt"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

function buildSystemInstruction(guidance: string, durationMinutes: number, language?: string, existingTitles?: string[], lessons?: string[], childAgeGroup?: string, avoid?: string, child?: ChildPersonalizationInput): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));
  const lessonPart = lessons?.length
    ? `\n\nSTORY VALUES\n------------\nEmbed the following values into the story through concrete actions the hero takes. Do NOT state the morals explicitly — let the character's choices show them:\n${lessons.map((l, i) => `${i + 1}. ${l}`).join("\n")}`
    : "";
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
    ? `\n\nLANGUAGE\n--------\nWrite all DIALOGUE and NARRATION in ${langName} (ISO 639-1: "${language}"). Character names, the story title, the top-level "summary" field, and each scene's "summary" field (in the scenes array) must also be in this language — these are shown directly to the listener, so they must match the story's language exactly like the dialogue does.\nEXCEPTIONS — keep these fields in English regardless of story language:\n  • SFX textPayload descriptions (sent to ElevenLabs sound generator — non-English produces garbled audio)\n  • visualDescription in the characters map (sent to Imagen avatar generator — non-English produces wrong images)\n  • coverPrompt (sent to Imagen image generator)\n  • The bracketed performance tag at the start of EVERY SINGLE dialogue/narration textPayload (e.g. "[warmly]", "[excited]") — the tag word itself always stays in English, from the first line to the last, with no drift back to the story's language partway through; only the spoken text after the closing "]" switches language. Example: "[warmly] בְּלֵב שְׁכוּנָה מְלֵאָה בְּצִבְעִים וְקולוֹת, גָּר רוֹן הַקָּטָן." NOT "[חַמִּים] ...".${language === "he" ? `\nHEBREW VOCALIZATION — MANDATORY, no exceptions: write every Hebrew word fully niqqud-ed (with vowel points, ניקוד מלא), e.g. "שָׁלוֹם" not "שלום". This applies to EVERY Hebrew field you output — the dialogue/narration text, the title, the top-level "summary" field, and each scene's "summary" field (in the scenes array) — not just the spoken lines. The top-level "summary" is shown to parents browsing the library and is also read by some screen readers, so it needs niqqud exactly as much as the script itself does. Unvocalized Hebrew text-to-speech mispronounces words constantly, so this is required for correct audio, not stylistic.` : ""}`
    : "";

  const titleUniquePart = existingTitles?.length
    ? `\n\nTITLE UNIQUENESS\n----------------\nThe following titles already exist in this family's library. You MUST pick a title that does NOT appear in this list (not even as a close variant or reordering of the same words):\n${existingTitles.map((t) => `  - "${t}"`).join("\n")}\nIf your first choice matches any of these, invent a different title.`
    : "";

  return `${guidance}${lessonPart}${agePart}${childPart}${langPart}${avoidPart}${titleUniquePart}\n\nRUNTIME TARGETS FOR THIS STORY\n-------------------------------\nTarget duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}\nTarget word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)\nTarget blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)\n\nSCENE STRUCTURE (required — output in "scenes" array)\n------------------------------------------------------\nDivide the story into 3–5 logical scenes based on natural story beats. For each scene output:\n  - sceneNumber: integer starting at 1\n  - title: 3–5 word evocative label (e.g. "The Moonlit Forest Path")\n  - summary: exactly 1 sentence describing what happens in this scene\n  - primaryMood: exactly one of the following moods (choose based on the definition, not just the name):
${buildMoodPromptSpec()}\n  - sfxTags: array of 2–4 short ambient/effect labels (e.g. ["crackling fire", "wind through trees"])\n  - lineRange: { "start": <first block index 0-based>, "end": <last block index 0-based, inclusive> }\n\nScene arc rule: build from an opening mood → engaging peak → low-stimulation soothing resolution (ideal for bedtime).\nlineRange indices must be contiguous, non-overlapping, and together cover all blocks from 0 to N-1.`;
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
    const ctx = await getFamilyContext(req);
    if (ctx) existingTitles = await getEntryTitles(ctx.familyId);
  } catch { /* best-effort */ }

  const systemInstruction = buildSystemInstruction(guidance, clampedDuration, body.language, existingTitles, body.lessons, body.childAgeGroup, body.avoid, {
    gender: body.gender,
    favoriteThemes: body.favoriteThemes,
    favoriteAnimals: body.favoriteAnimals,
    preferredFigures: body.preferredFigures,
    interests: body.interests,
    notes: body.notes,
  });
  // Reinforced here, not just in the system instruction — a numeric target
  // stated once at the tail of a 500+ line system brief was apparently getting
  // out-weighted by everything else in it (see buildLengthTargetReminder).
  const userPrompt = buildUserPrompt(seeds) + buildLengthTargetReminder(clampedDuration);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.85,
        // Unlike generate-story/route.ts, this route never set an explicit
        // token budget — relying on the SDK/API's own default, which is
        // lower than what a full response (title/summary/coverPrompt/
        // characters/blocks/scenes) can need. Confirmed directly: the exact
        // same prompt got cut off mid-response with finishReason MAX_TOKENS,
        // producing unterminated JSON ("Gemini returned non-JSON output").
        // Match generate-story's budget so this route doesn't truncate.
        maxOutputTokens: 8192,
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Gemini often doesn't hit the target word count on the first try (a
    // story requested at 2 minutes has come out well under a minute) —
    // check the actual output and, if it's off by more than 20%, ask Gemini
    // to expand/shorten and regenerate rather than silently accepting it.
    const targetWords = Math.round(clampedDuration * 140);
    const targetBlockRange = { min: Math.max(4, Math.round(clampedDuration * 2.5)), max: Math.max(8, Math.round(clampedDuration * 3.6)) };
    let raw: RawResponse | undefined;
    let currentPrompt = userPrompt;
    const maxLengthAttempts = 3;
    // Times just this retry loop — the raw script-writing step itself —
    // separately from casting/scene-generation/language-detection/etc. below,
    // so production_metrics can report generation time in isolation. See
    // markScriptDone in src/lib/perfMetrics.ts.
    const generationStartedAt = Date.now();

    for (let attempt = 1; attempt <= maxLengthAttempts; attempt++) {
      const result = await model.generateContent(currentPrompt);
      const um = result.response.usageMetadata;
      if (um) recordGeminiUsage({ callType: "script_generation" }, { model: "gemini-3.5-flash", inputTokens: um.promptTokenCount, outputTokens: um.candidatesTokenCount, totalTokens: um.totalTokenCount }).catch(() => {});
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
        console.warn(`[five-question-story] Attempt ${attempt} returned non-JSON output, retrying once immediately.`);
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
      console.warn(`[five-question-story] Attempt ${attempt}: ${actualWords} words vs target ${targetWords} — retrying with a length correction.`);
      currentPrompt = `${userPrompt}${buildLengthCorrectionNote(actualWords, targetWords, raw!.blocks?.length, targetBlockRange)}`;
    }
    const generationMs = Date.now() - generationStartedAt;

    if (!raw) {
      return NextResponse.json({ error: "Gemini returned non-JSON output after retries." }, { status: 502 });
    }

    // Fix title conflict if needed (small Gemini call, not a full regeneration)
    // — same as generate-story/route.ts's own resolveTitleConflict call.
    if (raw.title && existingTitles.length > 0) {
      raw.title = await resolveTitleConflict(genAI, raw.title, raw.summary ?? "", existingTitles);
    }

    // When the hero represents the child (Q1's "your own name" option defaults
    // the hero name to exactly the child's own name), cast the hero's voice by
    // the child's real gender instead of leaving primaryVoiceId undefined —
    // which silently fell back to a fixed preset (PRESET_VOICES[0]) regardless
    // of who the child actually is.
    const heroIsChild = !!body.childName && seeds.q1_hero.trim().toLowerCase() === body.childName.trim().toLowerCase();
    const heroVoiceId = heroIsChild && body.gender
      ? pickVoiceForCharacterProfile({ type: "child", gender: body.gender === "boy" ? "male" : body.gender === "girl" ? "female" : "neutral", voicePersona: "playful" })
      : undefined;
    const characterVoiceMap = await assignVoicesToCharacters(raw.blocks ?? [], seeds.q1_hero, heroVoiceId, raw.characters ?? {}, apiKey);
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

    // The LANGUAGE section above now explicitly instructs Gemini for ANY
    // requested language, including English — trust it whenever one was
    // requested. Only fall back to detecting what Gemini actually wrote when
    // no language was given at all.
    const detectedLanguage = body.language
      ? body.language
      : await detectGeneratedLanguage(splitBlocks, apiKey);

    // Hebrew-only: repair any words where Gemini accidentally rendered a
    // couple of mid-word letters in Latin script instead of Hebrew (see
    // config/hebrew-letter-check.txt) -- a TTS mispronunciation otherwise.
    const finalBlocks = detectedLanguage === "he"
      ? await fixHebrewLatinMixup(splitBlocks, apiKey)
      : splitBlocks;

    // See generate-story/route.ts for why this fallback exists: the scenes
    // array rides along with the same big generation call as the script
    // itself and sometimes comes back empty even though the story is fine.
    const finalScenes = remappedScenes.length > 0
      ? remappedScenes
      : await generateScenes(finalBlocks, apiKey);

    return NextResponse.json({ blocks: finalBlocks, title: raw.title ?? "", summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "", characters: raw.characters ?? {}, scenes: finalScenes, language: detectedLanguage, generationMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
