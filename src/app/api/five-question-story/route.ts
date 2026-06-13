import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/utils/buildStoryPrompt";
import type { StorySeeds } from "@/utils/buildStoryPrompt";

export interface FiveQuestionStoryRequest {
  seeds: StorySeeds;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: FiveQuestionStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { seeds } = body;
  if (!seeds?.q1_hero || !seeds?.q2_world || !seeds?.q3_companion || !seeds?.q4_engine || !seeds?.q5_mood) {
    return NextResponse.json({ error: "All 5 seeds are required." }, { status: 400 });
  }

  const userPrompt = buildUserPrompt(seeds);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = (err as { name?: string }).name === "AbortError";
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      return NextResponse.json(
        { error: isTimeout ? "Story generation timed out — please try again." : `Network error: ${String(err)}` },
        { status: 504 }
      );
    }
    clearTimeout(timer);

    if ((res.status === 529 || res.status === 503 || res.status === 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 2000));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Anthropic API ${res.status}: ${errText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const story: string = data.content?.[0]?.text ?? "";

    if (!story.trim()) {
      return NextResponse.json({ error: "Empty story returned." }, { status: 502 });
    }

    return NextResponse.json({ story });
  }

  return NextResponse.json({ error: "Story generation failed after 3 attempts." }, { status: 502 });
}
