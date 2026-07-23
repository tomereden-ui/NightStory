// Centralized $ pricing for every AI service this app calls — the single
// source of truth for cost math in src/lib/serviceUsage.ts. Verified against
// each provider's published rates as of July 2026; update here (and only
// here) if plans/pricing change. Deliberately server-only-ish (plain
// constants, no side effects) so it's safe to import from API routes.

// ─── Gemini text/JSON generation — priced per 1M tokens, input vs output ────
export const GEMINI_TEXT_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gemini-3.5-flash":       { inputPer1M: 1.50, outputPer1M: 9.00 },
  // Standard (<=200K token context) tier — this app's scripts never come
  // close to that threshold, so the long-context doubled rate never applies.
  "gemini-3.1-pro-preview": { inputPer1M: 2.00, outputPer1M: 12.00 },
};
// Fallback for any model string not in the table above (keeps cost tracking
// from silently going to $0 if a new model gets introduced before this file
// is updated) — flash's rate, the cheapest/most-used model, is the least
// likely to overstate cost.
const DEFAULT_TEXT_PRICING = GEMINI_TEXT_PRICING["gemini-3.5-flash"];

export function textCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = GEMINI_TEXT_PRICING[model] ?? DEFAULT_TEXT_PRICING;
  return (inputTokens / 1_000_000) * rate.inputPer1M + (outputTokens / 1_000_000) * rate.outputPer1M;
}

// ─── Gemini image generation — priced per output image (~1290 output tokens
// at $30/1M for the flash-image line; both model variants this app uses
// share that family's pricing structure) ────────────────────────────────────
export const GEMINI_IMAGE_COST_PER_IMAGE = 0.039;

// ─── Gemini TTS — dual-billed: input TEXT tokens + output AUDIO tokens ─────
// (25 audio tokens/sec of output). This app only ever has the input
// character count on hand (not a token count, and not the exact output
// duration), so cost is estimated from characters using typical English/
// Hebrew text-to-speech ratios: ~4 chars/token input, ~130 wpm / ~5.5
// chars/word speaking rate for the audio side. Approximate, but far closer
// than the flat per-char guess this replaced.
export const GEMINI_TTS_PRICING = { inputPer1M: 0.50, outputPer1M: 10.00 };
export function geminiTtsCostUsd(characters: number): number {
  const inputTokens = characters / 4;
  const estSpeechSeconds = characters / (130 * 5.5 / 60); // ~130 words/min, ~5.5 chars/word
  const outputTokens = estSpeechSeconds * 25; // 25 audio tokens/sec
  return (inputTokens / 1_000_000) * GEMINI_TTS_PRICING.inputPer1M + (outputTokens / 1_000_000) * GEMINI_TTS_PRICING.outputPer1M;
}

// ─── ElevenLabs ─────────────────────────────────────────────────────────────
// TTS (dialogue + previews): billed on the number of input characters sent,
// regardless of output audio length — eleven_v3 is this app's "Multilingual
// v2/v3" tier.
export const EL_TTS_COST_PER_CHAR = 0.10 / 1_000;
// Sound effects: billed per MINUTE of generated audio, not per prompt
// character — the app already sends a target duration_seconds to EL's
// sound-generation endpoint, so track that directly instead of prompt length.
export const EL_SFX_COST_PER_MINUTE = 0.12;
export function elSfxCostUsd(audioSeconds: number): number {
  return (audioSeconds / 60) * EL_SFX_COST_PER_MINUTE;
}
