import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

// ─── Pricing (same constants as admin page) ───────────────────────────────────
const PRICING = {
  gemini_token:    0.40 / 1_000_000,  // $0.40/1M tokens
  gemini_tts_char: 0.10 / 1_000_000,  // $0.10/1M chars
  gemini_image:    0.04,               // $0.04/image
  el_tts_char:     0.20 / 1_000,      // $0.20/1K chars
  el_sfx_call:     0.08,              // $0.08/effect
};

// ElevenLabs voice IDs are 15+ char alphanumeric strings; Gemini presets are names like "Aoede"
function isELVoice(id: string): boolean {
  return id.length >= 15 && /^[a-zA-Z0-9]+$/.test(id);
}

// Estimate SFX calls from drama planner behaviour:
// planner generates ~1 ambient loop + 1 spot SFX per 2-3 dialogue exchanges
function estimateSfx(durationSec: number, blockCount: number): number {
  const byDuration = Math.ceil((durationSec || 120) / 60) * 1.5;
  const byBlocks   = Math.max(2, Math.round(blockCount / 3));
  return Math.max(2, Math.round((byDuration + byBlocks) / 2));
}

// Estimate Gemini text-gen tokens per story:
//   script generation  = 800 input + (blockChars / 4) output
//   drama planning     = (blockChars / 4) input + 1200 output
//   profiling + misc   = 500
function estimateTokens(blockChars: number): number {
  return Math.round(800 + blockChars / 4 + blockChars / 4 + 1200 + 500);
}

export async function GET() {
  const { data: rows, error } = await supabase
    .from("stories")
    .select("id, title, duration_seconds, blocks, cover_url, is_public");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stories = (rows ?? []).map((row) => {
    const blocks = (row.blocks ?? []) as ScriptBlock[];

    let geminiChars = 0;
    let elChars = 0;
    for (const b of blocks) {
      const chars = b.textPayload?.length ?? 0;
      if (isELVoice(b.assignedVoiceId ?? "")) elChars += chars;
      else geminiChars += chars;
    }

    const totalChars        = geminiChars + elChars;
    const estimatedSfx      = estimateSfx(row.duration_seconds ?? 0, blocks.length);
    const estimatedTokens   = estimateTokens(totalChars);
    const hasCover          = !!row.cover_url;

    const costs = {
      geminiTextGen: estimatedTokens   * PRICING.gemini_token,
      geminiTts:     geminiChars       * PRICING.gemini_tts_char,
      geminiImage:   hasCover ? PRICING.gemini_image : 0,
      elTts:         elChars           * PRICING.el_tts_char,
      elSfx:         estimatedSfx      * PRICING.el_sfx_call,
    };
    const totalCost = Object.values(costs).reduce((s, c) => s + c, 0);

    return {
      id: row.id,
      title: row.title as string,
      isPublic: row.is_public as boolean,
      durationSeconds: (row.duration_seconds ?? 0) as number,
      blockCount: blocks.length,
      geminiChars,
      elChars,
      estimatedSfx,
      estimatedTokens,
      hasCover,
      costs: { ...costs, total: totalCost },
    };
  });

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const zero = { geminiTextGen: 0, geminiTts: 0, geminiImage: 0, elTts: 0, elSfx: 0, total: 0 };
  const totals = stories.reduce(
    (acc, s) => ({
      durationSeconds:  acc.durationSeconds  + s.durationSeconds,
      blockCount:       acc.blockCount       + s.blockCount,
      geminiChars:      acc.geminiChars      + s.geminiChars,
      elChars:          acc.elChars          + s.elChars,
      estimatedSfx:     acc.estimatedSfx     + s.estimatedSfx,
      estimatedTokens:  acc.estimatedTokens  + s.estimatedTokens,
      coverCount:       acc.coverCount       + (s.hasCover ? 1 : 0),
      costs: {
        geminiTextGen: acc.costs.geminiTextGen + s.costs.geminiTextGen,
        geminiTts:     acc.costs.geminiTts     + s.costs.geminiTts,
        geminiImage:   acc.costs.geminiImage   + s.costs.geminiImage,
        elTts:         acc.costs.elTts         + s.costs.elTts,
        elSfx:         acc.costs.elSfx         + s.costs.elSfx,
        total:         acc.costs.total         + s.costs.total,
      },
    }),
    { durationSeconds: 0, blockCount: 0, geminiChars: 0, elChars: 0,
      estimatedSfx: 0, estimatedTokens: 0, coverCount: 0, costs: { ...zero } },
  );

  return NextResponse.json({ stories, totals, storyCount: stories.length });
}
