// Thin wrapper around the Gemini generateContent REST endpoint.
// Automatically extracts usageMetadata (input/output token split) from every
// response and records one accurate, per-call, per-story cost row — see
// src/lib/serviceUsage.ts.

import { recordGeminiUsage } from "@/lib/serviceUsage";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { totalTokenCount?: number; promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; [key: string]: unknown };
}

export async function geminiPost(
  apiKey: string,
  model: string,
  body: object,
  // What this call is FOR (required — every call site should know), and
  // which story it belongs to when one exists yet. Cost tracking without a
  // call_type label is much less useful than the per-stage breakdown this
  // exists to enable, so this isn't optional the way storyId/jobId are.
  usage: { callType: string; storyId?: string | null; jobId?: string | null },
): Promise<{ data: GeminiResponse; ok: boolean; status: number }> {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as GeminiResponse;

  // Fire-and-forget — never let tracking errors surface to callers
  const um = data?.usageMetadata;
  if (um?.promptTokenCount || um?.candidatesTokenCount || um?.totalTokenCount) {
    recordGeminiUsage(
      { callType: usage.callType, storyId: usage.storyId, jobId: usage.jobId },
      { model, inputTokens: um.promptTokenCount, outputTokens: um.candidatesTokenCount, totalTokens: um.totalTokenCount },
    ).catch(() => {});
  }

  return { data, ok: res.ok, status: res.status };
}

/** Convenience: extract the first text part from a Gemini response */
export function geminiText(data: GeminiResponse): string {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}
