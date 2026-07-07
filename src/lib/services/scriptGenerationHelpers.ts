import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScriptBlock } from "@/types";

// ─── Long-block splitting ──────────────────────────────────────────────────────
// Gemini occasionally writes one giant block of narration/dialogue instead of
// several shorter beats — bad for TTS pacing, and directly caused a
// summary-audio timeout on a classic story whose "summary" was a raw 100+
// word narration dump. Rather than trust the prompt alone (a "keep it short"
// instruction drifts the same way the performance-tag instruction did), this
// deterministically re-chunks any block whose spoken text exceeds maxWords
// into multiple consecutive blocks for the same character at sentence
// boundaries, repeating the leading performance tag on each chunk since every
// block becomes its own independent TTS line. Returns an index map so callers
// that reference the ORIGINAL block indices (e.g. scenes' lineRange) can
// remap them against the new, longer array.

export function splitLongBlocks(blocks: ScriptBlock[], maxWords = 30): { blocks: ScriptBlock[]; indexMap: [number, number][] } {
  const result: ScriptBlock[] = [];
  const indexMap: [number, number][] = [];

  for (const block of blocks) {
    const startIdx = result.length;

    if (block.characterName === "SFX") {
      result.push({ ...block, blockOrder: result.length + 1 });
      indexMap.push([startIdx, startIdx]);
      continue;
    }

    const tagMatch = block.textPayload.match(/^(\[[^\]]+\]\s*)/);
    const tag = tagMatch ? tagMatch[1] : "";
    const spoken = tagMatch ? block.textPayload.slice(tagMatch[1].length) : block.textPayload;
    const wordCount = spoken.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount <= maxWords) {
      result.push({ ...block, blockOrder: result.length + 1 });
      indexMap.push([startIdx, startIdx]);
      continue;
    }

    // Greedily group sentences into chunks that stay under maxWords.
    const sentences = spoken.match(/[^.!?…]+[.!?…]*\s*/g) ?? [spoken];
    const chunks: string[] = [];
    let current = "";
    let currentWords = 0;
    for (const sentence of sentences) {
      const sWords = sentence.trim().split(/\s+/).filter(Boolean).length;
      if (currentWords > 0 && currentWords + sWords > maxWords) {
        chunks.push(current.trim());
        current = sentence;
        currentWords = sWords;
      } else {
        current += sentence;
        currentWords += sWords;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    chunks.forEach((chunk, i) => {
      result.push({
        ...block,
        id: i === 0 ? block.id : `${block.id}-${i}`,
        blockOrder: result.length + 1,
        textPayload: `${tag}${chunk}`,
      });
    });
    indexMap.push([startIdx, result.length - 1]);
  }

  return { blocks: result, indexMap };
}

// ─── Length targeting ──────────────────────────────────────────────────────────
// Shared by generate-story and five-question-story: both build a target word
// count from durationMinutes and put it in the prompt, but Gemini doesn't
// always hit it (a story requested at 2 minutes has come out well under a
// minute). These helpers let each route measure what it actually got and, if
// it's off by more than the tolerance, ask Gemini to expand or shorten while
// keeping the same characters/plot/tone — reusing the same generateContent
// call each route already has rather than a separate refinement endpoint.

export function estimateWordCount(blocks: { characterName: string; textPayload: string }[]): number {
  return blocks
    .filter((b) => b.characterName !== "SFX")
    .reduce((sum, b) => sum + b.textPayload.split(/\s+/).filter(Boolean).length, 0);
}

export function isWithinLengthTolerance(actual: number, target: number, tolerance = 0.2): boolean {
  return actual >= target * (1 - tolerance) && actual <= target * (1 + tolerance);
}

export function buildLengthCorrectionNote(actual: number, target: number): string {
  const min = Math.round(target * 0.8);
  const max = Math.round(target * 1.2);
  const tooShort = actual < target;
  return `\n\n[LENGTH CORRECTION — read carefully]\n` +
    `Your previous attempt produced approximately ${actual} spoken words, but this story needs approximately ${target} words ` +
    `(between ${min} and ${max}) to match the requested audio duration.\n` +
    (tooShort
      ? `EXPAND this story: add more scene detail, dialogue exchanges, sensory description, and character moments while ` +
        `keeping the same characters, plot, and tone. Do not rush the pacing to pad word count — genuinely develop the scenes.`
      : `SHORTEN this story: tighten dialogue, trim redundant description, and cut minor asides while keeping the same ` +
        `characters, plot, and tone. Preserve the beginning and the ending.`) +
    `\nRegenerate the FULL response in the exact same JSON format as before.`;
}

// ─── Title conflict resolution ────────────────────────────────────────────────
// Replaces each route's old fixConflictingTitle: previously fell back to
// appending a generic suffix ("A New Adventure", "(New)", etc.) after a single
// failed Gemini rename attempt. Never does that now — retries the Gemini
// rename a few times, and if every attempt still fails, returns the original
// title unchanged (a rare duplicate in the family's library is preferable to
// ever mangling a name Gemini or the user actually chose).

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function resolveTitleConflict(
  genAI: GoogleGenerativeAI,
  title: string,
  summary: string,
  existingTitles: string[],
): Promise<string> {
  const existNorm = new Set(existingTitles.map(normTitle));
  if (!existNorm.has(normTitle(title))) return title;

  const excluded = [...existingTitles];
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      const existList = excluded.slice(0, 20).map((t) => `"${t}"`).join(", ");
      const prompt = `The children's story title "${title}" already exists in this family's library. Based on this story summary: "${summary.slice(0, 200)}", suggest ONE alternative creative title. It must NOT be any of: ${existList}. Output ONLY the title, nothing else.`;
      const result = await model.generateContent(prompt);
      const alt = result.response.text().trim().replace(/^["'`]|["'`]$/g, "").trim();
      if (alt && alt.length > 2 && alt.length < 80 && !existNorm.has(normTitle(alt))) return alt;
      if (alt) excluded.push(alt); // don't let the next attempt suggest the same rejected alternative
    } catch {
      // try again
    }
  }

  return title;
}
