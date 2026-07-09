import { GoogleGenerativeAI } from "@google/generative-ai";
import { assignVoicesToCharacters } from "@/lib/services/voiceAssignment";
import { classifyCharacters } from "@/lib/services/characterClassifier";
import { getLessonsCatalog } from "@/constants/lessonsUi";
import { LANGUAGE_META } from "@/lib/i18n";
import { trackGemini } from "@/lib/usageTracker";
import type { LibraryEntry, CharacterProfile } from "@/lib/libraryStore";
import type { ScriptBlock, MoralLesson, Language } from "@/types";

// This module holds the four "policy" steps that can be re-applied to an
// EXISTING, already-produced story without touching its script text, cover
// image, or audio: cast/voice assignment, moral-lesson analysis, scene
// segmentation, and the summary blurb. Each one is a fresh Gemini read of the
// current script, never a rewrite of it. Shared between the single-purpose
// routes (analyze-lessons, reassign-voices) and admin/refresh-story, which
// runs all four together against one story.

// ─── Cast & voices ──────────────────────────────────────────────────────────
// Moved here from admin/reassign-voices/route.ts so admin/refresh-story can
// reuse the exact same logic instead of duplicating it.

export async function reassignVoicesForStory(
  entry: LibraryEntry,
  apiKey: string,
  narratorVoiceId: string | undefined,
): Promise<{ blocks: ScriptBlock[]; characterProfiles: Record<string, CharacterProfile>; changedCount: number }> {
  // Gemini's own guidance translates the literal word "Narrator" into the
  // story's language (e.g. "קריין" in Hebrew), so a plain name check misses
  // it for any non-English story. Find the real key via characterProfiles'
  // type field instead, which survives translation, and fall back to the
  // literal "Narrator" for older entries saved before profiles were persisted.
  const narratorName = Object.entries(entry.characterProfiles ?? {}).find(([, p]) => p.type === "narrator")?.[0]
    ?? "Narrator";

  const seen = new Set<string>();
  const nonNarratorChars = entry.blocks
    .map((b) => b.characterName)
    .filter((c) => c !== "SFX" && c !== narratorName && !seen.has(c) && seen.add(c));

  let freshProfiles: Record<string, CharacterProfile> = {};
  if (nonNarratorChars.length > 0) {
    const scriptSample = entry.blocks
      .filter((b) => b.characterName !== "SFX")
      .slice(0, 40)
      .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
      .join("\n");
    const classified = await classifyCharacters(nonNarratorChars, entry.summary, scriptSample, apiKey);
    freshProfiles = Object.fromEntries(
      Object.entries(classified).map(([name, c]) => [
        name,
        { type: c.type as CharacterProfile["type"], visualDescription: c.visualDescription },
      ]),
    );
  }

  // Preserve any existing Narrator profile entry untouched — it was never analyzed here.
  const existingNarratorProfile = entry.characterProfiles?.[narratorName];
  const characterProfiles: Record<string, CharacterProfile> = {
    ...freshProfiles,
    ...(existingNarratorProfile ? { [narratorName]: existingNarratorProfile } : {}),
  };

  const voiceMap = await assignVoicesToCharacters(entry.blocks, "", undefined, characterProfiles, apiKey);
  if (narratorVoiceId) voiceMap[narratorName] = narratorVoiceId;

  let changedCount = 0;
  const blocks = entry.blocks.map((b) => {
    if (b.characterName === "SFX") return b;
    const newVoice = voiceMap[b.characterName];
    if (!newVoice || newVoice === b.assignedVoiceId) return b;
    changedCount++;
    return { ...b, assignedVoiceId: newVoice };
  });

  return { blocks, characterProfiles, changedCount };
}

// ─── Moral lessons ──────────────────────────────────────────────────────────
// Moved here from analyze-lessons/route.ts (which still owns persisting the
// result for its own single-story use from Studio); refresh-story calls this
// directly and persists all four fields together in one write.

function buildLessonsSystemInstruction(language?: string): string {
  const canonicalLessons = getLessonsCatalog(language).map((l) => l.label);
  const meta = language ? LANGUAGE_META[language as Language] : undefined;
  const languageLine = meta
    ? `Respond entirely in ${meta.label} (${meta.nativeName}) — the story itself is in that language, so both the "lesson" name and the "how" explanation must be written in it too, not English.`
    : "Respond in English.";

  return `You are a children's literature analyst for NightStory, a bedtime-story audio app for kids aged 3-10.
You will receive a story's script (narration + dialogue lines). Identify which moral/values lessons are MEANINGFULLY embedded — shown through what a character does or decides, not just mentioned in passing.

${languageLine}

Prefer naming a value from this list when it fits: ${canonicalLessons.join(", ")}.
If a different, clearly distinct value is strongly present and none of the above fit, you may name it concisely (1-3 words).
Do not force a lesson that isn't really there — an empty result is fine for a purely fun/silly story with no real moral content.

Return ONLY raw JSON, no markdown fences: { "lessons": [{ "lesson": "<name>", "how": "<one short, parent-friendly sentence on the specific moment that shows it>" }] }
Order by how central the lesson is to the story, most central first. Return at most 4 lessons.`;
}

function scriptTextFromBlocks(blocks: ScriptBlock[]): string {
  return blocks
    .filter((b) => b.characterName !== "SFX" && b.textPayload?.trim())
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n");
}

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

// thinkingConfig is a valid Gemini API field not yet reflected in the SDK's
// typedefs -- fine on a standalone object (no excess-property check fires
// until it's spread into an actual generateModel() call, which is typed
// loosely enough there to accept it without complaint).
const READONLY_GENERATION_CONFIG = {
  temperature: 0.4,
  maxOutputTokens: 2048,
  thinkingConfig: { thinkingBudget: 0 },
};

export async function analyzeLessonsForStory(blocks: ScriptBlock[], apiKey: string, language?: string): Promise<MoralLesson[]> {
  const scriptText = scriptTextFromBlocks(blocks);
  if (!scriptText.trim()) return [];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    systemInstruction: buildLessonsSystemInstruction(language),
    generationConfig: READONLY_GENERATION_CONFIG,
  });
  const result = await model.generateContent(`Story script:\n\n${scriptText}`);
  const totalTokens = result.response.usageMetadata?.totalTokenCount;
  if (totalTokens) trackGemini(totalTokens).catch(() => {});
  const text = stripJsonFences(result.response.text());

  const parsed = JSON.parse(text) as { lessons?: { lesson?: string; how?: string }[] };
  return (parsed.lessons ?? [])
    .filter((l): l is { lesson: string; how: string } => Boolean(l.lesson?.trim() && l.how?.trim()))
    .map((l) => ({ lesson: l.lesson.trim(), how: l.how.trim() }))
    .slice(0, 4);
}

// ─── Scenes ─────────────────────────────────────────────────────────────────
// Deriving scenes for an already-written script (rather than as part of
// writing a new one) already exists as generateScenes() in sceneGenerator.ts,
// used by admin/regenerate-scenes -- reused directly rather than duplicated
// here; see that module for the scene-breakdown prompt itself.

// ─── Summary ────────────────────────────────────────────────────────────────
// New: a short, exciting blurb derived from the existing script — the same
// "reasonable length, makes you want to press play" rule applied to classics'
// tagline, generalized here for any story. Never rewrites the script itself.

export async function deriveSummaryForStory(blocks: ScriptBlock[], title: string, apiKey: string, language?: string): Promise<string> {
  const scriptText = scriptTextFromBlocks(blocks).slice(0, 4000);
  const meta = language ? LANGUAGE_META[language as Language] : undefined;
  const languageLine = meta
    ? `Write entirely in ${meta.label} (${meta.nativeName}), matching the story's own language.${
        language === "he" ? ` HEBREW VOCALIZATION — MANDATORY: write every Hebrew word fully niqqud-ed (with vowel points, ניקוד מלא), e.g. "שָׁלוֹם" not "שלום".` : ""
      }`
    : "Write in English.";

  const systemInstruction = `You are a copywriter for NightStory, a children's bedtime audio drama app.
Given an already-written story's script, write ONE short, exciting summary (1-2 sentences, under 40 words) that gives
parents a good sense of the story and makes them want to press play — not a plot recap, a hook.
${languageLine}
Never append a generic tagline like "a new adventure" — describe THIS story specifically.
Return ONLY the summary text, nothing else, no quotes.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    systemInstruction,
    generationConfig: { ...READONLY_GENERATION_CONFIG, maxOutputTokens: 300 },
  });
  const result = await model.generateContent(`Title: ${title}\n\nScript:\n${scriptText}`);
  const totalTokens = result.response.usageMetadata?.totalTokenCount;
  if (totalTokens) trackGemini(totalTokens).catch(() => {});
  return result.response.text().trim().replace(/^["'`]|["'`]$/g, "").trim();
}
