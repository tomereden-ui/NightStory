// Per-call service usage log — the accurate replacement for usageTracker.ts's
// cumulative-blob counters. Every AI API call this app makes should insert
// exactly one row here, with enough detail (model, call_type, story_id,
// token/char/duration counts) to answer "what did this cost, per call, per
// story, and in total" from a single table — see service-usage-migration.sql
// and src/app/api/admin/cost-analysis/route.ts.
//
// Never throws — a tracking failure must never break the actual production/
// generation/chat flow it's measuring.

import { supabase } from "@/lib/supabase";
import { textCostUsd, geminiTtsCostUsd, elSfxCostUsd, EL_TTS_COST_PER_CHAR, GEMINI_IMAGE_COST_PER_IMAGE } from "@/lib/pricing";

interface CallContext {
  storyId?: string | null;
  jobId?: string | null;
  callType: string;
}

async function insertUsageRow(row: {
  story_id: string | null;
  job_id: string | null;
  provider: string;
  model: string;
  call_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  characters: number | null;
  audio_seconds: number | null;
  units: number | null;
  cost_usd: number;
}): Promise<void> {
  try {
    const { error } = await supabase.from("service_usage").insert(row);
    if (error) console.warn("[serviceUsage] insert failed:", error.message);
  } catch (err) {
    console.warn("[serviceUsage] insert threw:", err);
  }
}

/** Gemini text/JSON generation calls — script writing, validation passes,
 *  casting, chat replies, etc. Pass the SPLIT input/output token counts from
 *  `usageMetadata.promptTokenCount`/`candidatesTokenCount` when available
 *  (accurate cost); falling back to a single blended count only degrades to
 *  an approximation, never to zero. */
export async function recordGeminiUsage(
  ctx: CallContext,
  meta: { model: string; inputTokens?: number; outputTokens?: number; totalTokens?: number },
): Promise<void> {
  let inputTokens = meta.inputTokens ?? 0;
  let outputTokens = meta.outputTokens ?? 0;
  if (!inputTokens && !outputTokens && meta.totalTokens) {
    // No split available — assume a 1:3 input:output ratio (roughly typical
    // for this app's calls, which send a long system instruction but often
    // ask for a shorter structured reply) rather than crediting it all to
    // whichever rate happens to be cheaper.
    inputTokens = Math.round(meta.totalTokens * 0.25);
    outputTokens = meta.totalTokens - inputTokens;
  }
  if (inputTokens <= 0 && outputTokens <= 0) return;
  await insertUsageRow({
    story_id: ctx.storyId ?? null,
    job_id: ctx.jobId ?? null,
    provider: "gemini",
    model: meta.model,
    call_type: ctx.callType,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    characters: null,
    audio_seconds: null,
    units: null,
    cost_usd: textCostUsd(meta.model, inputTokens, outputTokens),
  });
}

/** Gemini image generation (cover art) — billed per image, not per token. */
export async function recordGeminiImageUsage(ctx: CallContext, meta: { model: string }): Promise<void> {
  await insertUsageRow({
    story_id: ctx.storyId ?? null,
    job_id: ctx.jobId ?? null,
    provider: "gemini",
    model: meta.model,
    call_type: ctx.callType,
    input_tokens: null,
    output_tokens: null,
    characters: null,
    audio_seconds: null,
    units: 1,
    cost_usd: GEMINI_IMAGE_COST_PER_IMAGE,
  });
}

/** Text-to-speech calls — both engines bill primarily on input character
 *  count, though the actual per-character rate/model differs. */
export async function recordTtsUsage(
  ctx: CallContext,
  meta: { provider: "gemini" | "elevenlabs"; model: string; characters: number },
): Promise<void> {
  if (!meta.characters || meta.characters <= 0) return;
  const cost = meta.provider === "elevenlabs"
    ? meta.characters * EL_TTS_COST_PER_CHAR
    : geminiTtsCostUsd(meta.characters);
  await insertUsageRow({
    story_id: ctx.storyId ?? null,
    job_id: ctx.jobId ?? null,
    provider: meta.provider,
    model: meta.model,
    call_type: ctx.callType,
    input_tokens: null,
    output_tokens: null,
    characters: meta.characters,
    audio_seconds: null,
    units: null,
    cost_usd: cost,
  });
}

/** ElevenLabs sound-effect generation — billed per minute of OUTPUT audio,
 *  not per prompt character (the previous tracking used description length,
 *  which has no bearing on EL's actual billing basis). */
export async function recordSfxUsage(
  ctx: CallContext,
  meta: { model: string; audioSeconds: number },
): Promise<void> {
  if (!meta.audioSeconds || meta.audioSeconds <= 0) return;
  await insertUsageRow({
    story_id: ctx.storyId ?? null,
    job_id: ctx.jobId ?? null,
    provider: "elevenlabs",
    model: meta.model,
    call_type: ctx.callType,
    input_tokens: null,
    output_tokens: null,
    characters: null,
    audio_seconds: meta.audioSeconds,
    units: null,
    cost_usd: elSfxCostUsd(meta.audioSeconds),
  });
}
