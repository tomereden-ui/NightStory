// Server-side usage tracker — persists cumulative API token/character counts
// to Supabase Storage as a JSON file. Read-modify-write is acceptable here
// since occasional concurrent overwrites only cause minor undercounting.

import { supabase, ensureBuckets } from "@/lib/supabase";

const BUCKET = "usage-stats";
const FILE   = "totals.json";

export interface UsageTotals {
  gemini_tokens:      number;
  gemini_calls:       number;
  gemini_tts_chars:   number;
  gemini_tts_calls:   number;
  gemini_image_calls: number;
  el_tts_chars:       number;
  el_tts_calls:       number;
  el_sfx_chars:       number;
  el_sfx_calls:       number;
  pollinations_calls: number;
}

const ZERO: UsageTotals = {
  gemini_tokens:      0, gemini_calls:       0,
  gemini_tts_chars:   0, gemini_tts_calls:   0,
  gemini_image_calls: 0,
  el_tts_chars:       0, el_tts_calls:       0,
  el_sfx_chars:       0, el_sfx_calls:       0,
  pollinations_calls: 0,
};

let usageBucketReady = false;
async function ensureUsageBucket() {
  await ensureBuckets();
  if (usageBucketReady) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[Usage] bucket error:", error.message);
  }
  usageBucketReady = true;
}

export async function readTotals(): Promise<UsageTotals> {
  try {
    await ensureUsageBucket();
    const { data } = await supabase.storage.from(BUCKET).download(FILE);
    if (!data) return { ...ZERO };
    const text = await data.text();
    return { ...ZERO, ...JSON.parse(text) };
  } catch {
    return { ...ZERO };
  }
}

async function writeTotals(t: UsageTotals): Promise<void> {
  await ensureUsageBucket();
  const blob = new Blob([JSON.stringify(t)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(FILE, blob, { upsert: true });
}

async function increment(key: keyof UsageTotals, amount: number): Promise<void> {
  try {
    const current = await readTotals();
    current[key] = (current[key] ?? 0) + amount;
    await writeTotals(current);
  } catch (err) {
    console.warn("[Usage] increment failed:", err);
  }
}

export async function trackGemini(tokens: number): Promise<void> {
  if (!tokens || tokens <= 0) return;
  const current = await readTotals().catch(() => ({ ...ZERO }));
  current.gemini_tokens += tokens;
  current.gemini_calls  += 1;
  await writeTotals(current).catch(() => {});
}

export async function trackGeminiTts(chars: number): Promise<void> {
  if (!chars || chars <= 0) return;
  const current = await readTotals().catch(() => ({ ...ZERO }));
  current.gemini_tts_chars += chars;
  current.gemini_tts_calls += 1;
  await writeTotals(current).catch(() => {});
}

export async function trackELTts(chars: number): Promise<void> {
  if (!chars || chars <= 0) return;
  const current = await readTotals().catch(() => ({ ...ZERO }));
  current.el_tts_chars += chars;
  current.el_tts_calls += 1;
  await writeTotals(current).catch(() => {});
}

export async function trackELSfx(chars: number): Promise<void> {
  if (!chars || chars <= 0) return;
  const current = await readTotals().catch(() => ({ ...ZERO }));
  current.el_sfx_chars += chars;
  current.el_sfx_calls += 1;
  await writeTotals(current).catch(() => {});
}

export async function trackGeminiImage(): Promise<void> {
  const current = await readTotals().catch(() => ({ ...ZERO }));
  current.gemini_image_calls += 1;
  await writeTotals(current).catch(() => {});
}

export async function trackPollinations(): Promise<void> {
  const current = await readTotals().catch(() => ({ ...ZERO }));
  current.pollinations_calls += 1;
  await writeTotals(current).catch(() => {});
}

// Alias kept for callers that just want to bump the counter
export { increment };
