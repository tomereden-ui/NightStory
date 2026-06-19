// Thin wrapper around the Gemini generateContent REST endpoint.
// Automatically extracts usageMetadata.totalTokenCount from every response
// and fires a background trackGemini() call so token counts are always recorded.

import { trackGemini } from "@/lib/usageTracker";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { totalTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; [key: string]: unknown };
}

export async function geminiPost(
  apiKey: string,
  model: string,
  body: object,
): Promise<{ data: GeminiResponse; ok: boolean; status: number }> {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as GeminiResponse;

  // Fire-and-forget — never let tracking errors surface to callers
  const tokens = data?.usageMetadata?.totalTokenCount;
  if (tokens && tokens > 0) trackGemini(tokens).catch(() => {});

  return { data, ok: res.ok, status: res.status };
}

/** Convenience: extract the first text part from a Gemini response */
export function geminiText(data: GeminiResponse): string {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}
