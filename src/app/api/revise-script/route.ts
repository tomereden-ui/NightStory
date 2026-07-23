import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { splitLongBlocks } from "@/lib/services/scriptGenerationHelpers";
import { readRevisionGuidance } from "@/lib/services/storyGuidance";
import { recordScriptRevision } from "@/lib/perfMetrics";
import { recordGeminiUsage } from "@/lib/serviceUsage";
import { supabase } from "@/lib/supabase";
import type { ScriptBlock } from "@/types";

interface RawBlock {
  id: string;
  blockOrder: number;
  characterName: string;
  assignedVoiceId: string;
  textPayload: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  const { blocks, instruction, targetBlockId, lessons, storyId } = await req.json() as {
    blocks: ScriptBlock[];
    instruction: string;
    targetBlockId?: string;
    lessons?: string[];
    // The story's production_metrics row id, if one exists yet (it's created
    // the moment the script is first saved — see markScriptDone) — lets this
    // revision get recorded as a numbered pre-production phase. Undefined for
    // a revision applied before that initial save has resolved; the revision
    // itself still proceeds normally either way.
    storyId?: string;
  };

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: "blocks array is required." }, { status: 400 });
  }
  if (!instruction?.trim()) {
    return NextResponse.json({ error: "instruction is required." }, { status: 400 });
  }

  const isTargeted = Boolean(targetBlockId);
  const hasLessons = Array.isArray(lessons) && lessons.length > 0;

  const lessonSection = hasLessons ? `
STORY VALUES TO EMBED:
${lessons!.map((l, i) => `${i + 1}. ${l}`).join("\n")}
Weave these values into the revised script through concrete character actions — do NOT state them explicitly.
After the blocks, include a "lessonImplementations" array (one entry per lesson):
  { "lesson": "<exact name>", "implemented": true|false, "how": "<one sentence on the specific moment>", "blockIndices": [<0-based indices of the 1–2 relevant blocks>] }
` : "";

  const returnFormat = hasLessons
    ? `Return a JSON object: { "blocks": [...same-order array...], "lessonImplementations": [...] }. No markdown fences.`
    : `Return ONLY the raw JSON array. No markdown fences, no explanation.`;

  const guidance = readRevisionGuidance();
  const guidanceSection = guidance
    ? `\nSTORY POLICY — this story was originally written to these standards; every edit you make must stay within them too:\n${guidance}\n`
    : "";

  const systemInstruction = `You are a creative script editor for NightStory, a children's bedtime audio drama app.
You will receive a script as a JSON array and a director's instruction. Apply the instruction faithfully.
${guidanceSection}
EDIT RULES (these govern HOW you apply the instruction — the policy above governs WHAT is allowed in the result):
- Preserve EVERY block's id, blockOrder, characterName, and assignedVoiceId exactly.
- Make the SMALLEST edit that achieves the instruction — change as few blocks as possible, and leave the wording of every other block exactly as it was. Only modify textPayload where the instruction actually applies.
- Preserve existing [audio tags] style marks or update them to match the new tone.
- SFX blocks (characterName === "SFX") should only be modified if the instruction explicitly targets sounds, or if a nearby dialogue/narration change you made would leave an SFX description describing a moment that no longer happens.
- Keep language appropriate for children aged 3-10.
- Do not add new blocks or remove existing blocks — this also means no new characters, since a new character would require a new block.
${isTargeted ? `- Only the block with id "${targetBlockId}" should be changed. Leave all other blocks exactly as they are.` : "- Apply the instruction across the whole script as it makes sense."}
${lessonSection}
${returnFormat}`;

  const scriptJson = JSON.stringify(blocks, null, 2);
  const userPrompt = `Director's instruction: "${instruction.trim()}"\n\nScript:\n${scriptJson}`;

  // Times the whole revision (both retry paths below) so it can be recorded
  // as one numbered pre-production phase — see recordScriptRevision.
  const revisionStartedAt = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // A revision echoes the ENTIRE script back, so a malformed/truncated
    // response is a real risk on longer scripts (the same failure mode
    // already fixed for generation) — give it one immediate retry before
    // giving up, rather than surfacing "Gemini returned invalid JSON" on
    // the first bad response.
    const generateAndParse = async <T,>(): Promise<{ text: string; parsed: T } | null> => {
      const result = await model.generateContent(userPrompt);
      const um = result.response.usageMetadata;
      if (um) recordGeminiUsage({ callType: hasLessons ? "lesson_rewrite" : "director_note_revise", storyId }, { model: "gemini-3.5-flash", inputTokens: um.promptTokenCount, outputTokens: um.candidatesTokenCount, totalTokens: um.totalTokenCount }).catch(() => {});
      const text = result.response.text().trim()
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      try {
        return { text, parsed: JSON.parse(text) as T };
      } catch {
        return null;
      }
    };

    if (hasLessons) {
      // Expect { blocks: [...], lessonImplementations: [...] }
      type Parsed = { blocks: RawBlock[]; lessonImplementations?: { lesson: string; implemented: boolean; how: string; blockIndices: number[] }[] };
      let attempt = await generateAndParse<Parsed>();
      if (!attempt || !Array.isArray(attempt.parsed.blocks)) attempt = await generateAndParse<Parsed>();
      if (!attempt || !Array.isArray(attempt.parsed.blocks)) {
        return NextResponse.json({ error: "Gemini returned invalid JSON.", raw: attempt?.text.slice(0, 300) }, { status: 502 });
      }
      const parsed = attempt.parsed;

      const merged: ScriptBlock[] = parsed.blocks.map((r, i) => ({
        ...(blocks[i] ?? {}),
        ...r,
        id: blocks[i]?.id ?? r.id,
        blockOrder: i + 1,
        lessonHighlight: undefined as ScriptBlock["lessonHighlight"],
      }));

      const lessonImplementations: { lesson: string; implemented: boolean; how: string }[] = [];
      for (const impl of parsed.lessonImplementations ?? []) {
        lessonImplementations.push({ lesson: impl.lesson, implemented: impl.implemented, how: impl.how });
        if (impl.implemented && Array.isArray(impl.blockIndices)) {
          for (const idx of impl.blockIndices) {
            if (idx >= 0 && idx < merged.length) {
              merged[idx] = { ...merged[idx], lessonHighlight: { lesson: impl.lesson, how: impl.how } };
            }
          }
        }
      }

      // Re-chunk any block Gemini wrote too long (bad for TTS pacing) into
      // several shorter consecutive blocks — lessonHighlight, already
      // assigned per-block above, carries forward onto every resulting chunk.
      if (storyId) {
        // Awaited, not fire-and-forget: a `void` promise racing the response
        // return can be silently killed on serverless-style hosts, and the
        // extra couple of DB round trips are nothing next to the Gemini call
        // this request just made. recordScriptRevision never throws.
        await recordScriptRevision(supabase, { storyId, type: "lesson_rewrite", ms: Date.now() - revisionStartedAt, instruction });
      }
      return NextResponse.json({ blocks: splitLongBlocks(merged, 30).blocks, lessonImplementations });
    }

    // Standard path — plain array
    let attempt = await generateAndParse<RawBlock[]>();
    if (!attempt || !Array.isArray(attempt.parsed)) attempt = await generateAndParse<RawBlock[]>();
    if (!attempt || !Array.isArray(attempt.parsed)) {
      return NextResponse.json({ error: "Gemini returned invalid JSON.", raw: attempt?.text.slice(0, 300) }, { status: 502 });
    }
    const revised = attempt.parsed;

    const merged = revised.map((r, i) => ({
      ...(blocks[i] ?? {}),
      ...r,
      id: blocks[i]?.id ?? r.id,
      blockOrder: i + 1,
    }));

    if (storyId) {
      // Awaited for the same reason as the lessons path above.
      await recordScriptRevision(supabase, { storyId, type: "directors_note", ms: Date.now() - revisionStartedAt, instruction });
    }
    return NextResponse.json({ blocks: splitLongBlocks(merged, 30).blocks });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
