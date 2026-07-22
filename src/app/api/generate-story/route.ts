import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { assignVoicesToCharacters, pickVoiceForCharacterProfile } from "@/lib/services/voiceAssignment";
import { trackGemini } from "@/lib/usageTracker";
import { getEntryTitles } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";
import { estimateWordCount, isWithinLengthTolerance, buildLengthCorrectionNote, buildLengthTargetReminder, resolveTitleConflict, splitLongBlocks, detectGeneratedLanguage, fixHebrewLatinMixup, ageLanguageRules, buildChildPersonalizationPart, type ChildPersonalizationInput } from "@/lib/services/scriptGenerationHelpers";
import { generateScenes } from "@/lib/services/sceneGenerator";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Shown when Gemini's safety filter blocks a request that read as
// completely benign — a real (if occasional) false-positive category for
// non-English content in particular. Kept short and warm, matching the
// tone of the other kid-facing validation messages in this app (see
// /api/validate-wizard-text, /api/chat's clarification loop).
const BLOCKED_CONTENT_MESSAGES: Record<string, string> = {
  en: "That idea touched something our safety filter didn't like — try describing it a little differently! ✨",
  he: "הרעיון הזה נגע במשהו שמסנן הבטיחות שלנו לא אהב — נסו לתאר אותו קצת אחרת! ✨",
  ar: "لامست هذه الفكرة شيئًا لم يعجب مرشح الأمان لدينا — جربوا وصفها بطريقة مختلفة قليلاً! ✨",
  fr: "Cette idée a touché quelque chose que notre filtre de sécurité n'a pas aimé — essayez de la décrire un peu différemment ! ✨",
  es: "Esa idea tocó algo que nuestro filtro de seguridad no permitió — ¡intenta describirla de otra manera! ✨",
  de: "Diese Idee hat etwas berührt, das unser Sicherheitsfilter nicht mochte — versuch, sie ein wenig anders zu beschreiben! ✨",
  it: "Quell'idea ha toccato qualcosa che il nostro filtro di sicurezza non ha gradito — prova a descriverla in modo un po' diverso! ✨",
  pt: "Essa ideia tocou em algo que nosso filtro de segurança não permitiu — tente descrevê-la de um jeito um pouco diferente! ✨",
  ja: "そのアイデアは安全フィルターに引っかかってしまいました — 少し違う言い方で説明してみてください! ✨",
  hi: "उस विचार ने हमारे सुरक्षा फ़िल्टर को कुछ ऐसा छुआ जो उसे पसंद नहीं आया — कृपया इसे थोड़ा अलग तरीके से बताएं! ✨",
};

// After a genuine safety-filter block, offer the user a one-tap "try this
// instead" option rather than a dead end. Most real blocks in practice turn
// out to be a linguistic-ambiguity false positive (a word/phrase that reads
// one way in context but pattern-matches a sensitive category out of it) --
// this asks Gemini to reword ONLY that ambiguity while preserving every
// specific story detail exactly, so the suggestion still reads as "their
// story," not a different one. Deliberately never auto-retried server-side:
// the reworded text is surfaced to the user to accept or edit, not silently
// substituted -- an automated loop whose job is to route around a
// child-safety classifier is the wrong thing to build here, even for a
// confirmed false positive.
async function suggestSaferRewrite(genAI: GoogleGenerativeAI, body: GenerateStoryRequest): Promise<Record<string, string> | null> {
  const fields: Record<string, string> = {};
  if (body.mode === "prompt" && body.promptText) {
    fields.promptText = body.promptText;
  } else {
    if (body.hero) fields.hero = body.hero;
    if (body.setting) fields.setting = body.setting;
    if (body.plot) fields.plot = body.plot;
  }
  if (Object.keys(fields).length === 0) return null;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        temperature: 0.3, maxOutputTokens: 512, responseMimeType: "application/json",
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const prompt = `A children's bedtime-story element below was flagged by an automated safety filter, even though it reads as completely appropriate for a bedtime story. Filters like this occasionally misfire on wording that is linguistically ambiguous between an innocent meaning and an unrelated one out of context (e.g. a possessive word that can mean either "my uncle" or something else entirely, depending on context).

Reword each field to remove ONLY that kind of ambiguity, in the SAME language it's already written in. Preserve every specific detail EXACTLY — the same characters, named objects, actions, relationships, and setting. Do not soften, remove, generalize, or invent any story element; this must still read as the same story, just phrased less ambiguously.

Fields (JSON):
${JSON.stringify(fields)}

Return ONLY a JSON object with the exact same keys, each containing the reworded text.`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      const val = parsed[key];
      if (typeof val === "string" && val.trim()) out[key] = val.trim();
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (err) {
    // Best-effort only -- never let a failure here affect the main blocked-
    // response path (the user still gets the plain "please rephrase" message).
    console.warn("[generate-story] suggestSaferRewrite failed:", err);
    return null;
  }
}

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
  // remaining child-profile fields — see buildChildPersonalizationPart
  gender?: "boy" | "girl" | "other";
  favoriteThemes?: string[];
  favoriteAnimals?: string[];
  preferredFigures?: string[];
  interests?: string;
  notes?: string;
  // The active child's own name — compared against the hero name to detect
  // "the hero IS the child", so the hero's voice can be cast by the child's
  // real gender instead of whatever primaryVoiceId the caller sent (which in
  // practice was either a fixed default or, from the wizard-mode chat call,
  // a vestigial hardcoded "v1" that isn't a real preset id at all).
  childName?: string;
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

function buildSystemInstruction(guidance: string, durationMinutes: number, childAgeGroup?: string, lesson?: string, lessons?: string[], language?: string, avoid?: string, existingTitles?: string[], child?: ChildPersonalizationInput): string {
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks   = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks   = Math.max(8, Math.round(durationMinutes * 3.6));
  const agePart     = childAgeGroup ? `\n\n${ageLanguageRules(childAgeGroup)}` : "";
  const childPart   = child ? buildChildPersonalizationPart(child) : "";
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

  return `${guidance}${lessonPart}${agePart}${childPart}${langPart}${avoidPart}${titleUniquePart}\n\nRUNTIME TARGETS FOR THIS STORY\n-------------------------------\nTarget duration  : ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}\nTarget word count: ${targetWords - 60}–${targetWords + 60} spoken words (SFX blocks do not count)\nTarget blocks    : ${minBlocks}–${maxBlocks} total blocks (speech + SFX combined)\n\nSCENE STRUCTURE (required — output in "scenes" array)\n------------------------------------------------------\nDivide the story into 3–5 logical scenes based on natural story beats. For each scene output:\n  - sceneNumber: integer starting at 1\n  - title: 3–5 word evocative label (e.g. "The Moonlit Forest Path")\n  - summary: exactly 1 sentence describing what happens in this scene\n  - primaryMood: exactly one of — Gentle, Whimsical, Playful, Tense, Soothing, Wondrous, Cozy\n  - sfxTags: array of 2–4 short ambient/effect labels (e.g. ["crackling fire", "wind through trees"])\n  - lineRange: { "start": <first block index 0-based>, "end": <last block index 0-based, inclusive> }\n\nScene arc rule: build from an opening mood → engaging peak → low-stimulation soothing resolution (ideal for bedtime).\nlineRange indices must be contiguous, non-overlapping, and together cover all blocks from 0 to N-1.`;
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
  // Reinforced here, not just in the system instruction — a numeric target
  // stated once at the tail of a 500+ line system brief was apparently getting
  // out-weighted by everything else in it (see buildLengthTargetReminder).
  const prompt = buildUserPrompt(body) + buildLengthTargetReminder(durationMinutes);

  let existingTitles: string[] = [];
  try {
    const ctx = await getFamilyContext(req);
    if (ctx) existingTitles = await getEntryTitles(ctx.familyId);
  } catch { /* best-effort — don't block generation if DB is unreachable */ }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: buildSystemInstruction(guidance, durationMinutes, body.childAgeGroup, body.lesson, body.lessons, body.language, body.avoid, existingTitles, {
        gender: body.gender,
        favoriteThemes: body.favoriteThemes,
        favoriteAnimals: body.favoriteAnimals,
        preferredFigures: body.preferredFigures,
        interests: body.interests,
        notes: body.notes,
      }),
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
    const targetBlockRange = { min: Math.max(4, Math.round(durationMinutes * 2.5)), max: Math.max(8, Math.round(durationMinutes * 3.6)) };
    let raw: RawResponse | undefined;
    let currentPrompt = prompt;
    const maxLengthAttempts = 3;

    for (let attempt = 1; attempt <= maxLengthAttempts; attempt++) {
      // result.response.text() throws (not the generateContent() call itself)
      // when Gemini's safety filter blocks the response -- so it must be
      // inside the same try/catch as generateContent(), not read afterward,
      // or a blocked attempt crashes straight past all retry logic below
      // with an opaque 500 instead of getting a retry like every other
      // failure mode here.
      let text: string;
      try {
        const result = await model.generateContent(currentPrompt);
        const _t = result.response.usageMetadata?.totalTokenCount;
        if (_t) trackGemini(_t).catch(() => {});
        text = result.response.text().trim();
      } catch (err) {
        console.warn(`[generate-story] Gemini attempt ${attempt} failed (${err instanceof Error ? err.message : "unknown error"}), retrying once:`, err);
        try {
          const retryResult = await model.generateContent(currentPrompt);
          const _t = retryResult.response.usageMetadata?.totalTokenCount;
          if (_t) trackGemini(_t).catch(() => {});
          text = retryResult.response.text().trim();
        } catch (err2) {
          if (attempt === maxLengthAttempts) {
            const blocked = err2 instanceof Error && /PROHIBITED_CONTENT|blocked/i.test(err2.message);
            const suggestedRewrite = blocked ? await suggestSaferRewrite(genAI, body) : null;
            return NextResponse.json({
              error: blocked
                ? (BLOCKED_CONTENT_MESSAGES[body.language ?? "en"] ?? BLOCKED_CONTENT_MESSAGES.en)
                : (err2 instanceof Error ? err2.message : "Story generation failed."),
              blocked,
              ...(suggestedRewrite ? { suggestedRewrite } : {}),
            }, { status: blocked ? 422 : 502 });
          }
          console.warn(`[generate-story] Attempt ${attempt} failed twice (${err2 instanceof Error ? err2.message : "unknown error"}), moving to next attempt.`);
          continue;
        }
      }
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
      currentPrompt = `${prompt}${buildLengthCorrectionNote(actualWords, targetWords, raw!.blocks?.length, targetBlockRange)}`;
    }

    if (!raw) {
      return NextResponse.json({ error: "Gemini returned non-JSON output after retries." }, { status: 502 });
    }

    // Fix title conflict if needed (small Gemini call, not a full regeneration)
    if (raw.title && existingTitles.length > 0) {
      raw.title = await resolveTitleConflict(genAI, raw.title, raw.summary ?? "", existingTitles);
    }

    const heroName = body.hero ?? "";
    // When the hero represents the child (wizard-mode "Main character" field
    // set to exactly the child's own name), cast the hero's voice by the
    // child's real gender rather than trusting body.primaryVoiceId — in
    // practice that was either a fixed default (prompt mode, which never sent
    // it) or a vestigial hardcoded "v1" from the chat UI that isn't a real
    // preset id at all.
    const heroIsChild = !!body.childName && heroName.trim().toLowerCase() === body.childName.trim().toLowerCase();
    const heroVoiceId = heroIsChild && body.gender
      ? pickVoiceForCharacterProfile({ type: "child", gender: body.gender === "boy" ? "male" : body.gender === "girl" ? "female" : "neutral", voicePersona: "playful" })
      : body.primaryVoiceId;
    // Gemini's preset pool now voices every language, so casting no longer
    // needs a separate Hebrew EL-voice path.
    const characterVoiceMap = await assignVoicesToCharacters(raw.blocks ?? [], heroName, heroVoiceId, raw.characters ?? {}, apiKey);
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

    // Hebrew-only: repair any words where Gemini accidentally rendered a
    // couple of mid-word letters in Latin script instead of Hebrew (see
    // config/hebrew-letter-check.txt) -- a TTS mispronunciation otherwise.
    const finalBlocks = detectedLanguage === "he"
      ? await fixHebrewLatinMixup(splitBlocks, apiKey)
      : splitBlocks;

    // The scenes array above rides along with the same big Gemini call that
    // wrote the whole script -- one requirement among many competing for the
    // model's attention, so it sometimes comes back empty even though
    // nothing else about the story failed. generateScenes() runs scene
    // segmentation as its own focused call (already relied on at production
    // time in produce-drama) and is markedly more reliable, so fall back to
    // it here rather than leaving the Studio Scenes panel empty for a
    // perfectly good story.
    const finalScenes = remappedScenes.length > 0
      ? remappedScenes
      : await generateScenes(finalBlocks, apiKey);

    return NextResponse.json({ blocks: finalBlocks, title: raw.title ?? "", summary: raw.summary ?? "", coverPrompt: raw.coverPrompt ?? "", lessonImplementations, characters: raw.characters ?? {}, scenes: finalScenes, language: detectedLanguage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
