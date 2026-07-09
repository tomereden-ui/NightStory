import { NextRequest, NextResponse } from "next/server";
import { geminiPost } from "@/lib/geminiClient";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ valid: true }); // fail open

  let description: string;
  try {
    ({ description } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!description?.trim()) {
    return NextResponse.json({ valid: false, reason: "Description is empty" });
  }

  const prompt = `You are a sound design validator. Does the following text describe a concrete, physically producible sound effect that can be realistically generated as audio?

Respond ONLY with valid JSON (no markdown): { "valid": boolean, "reason": string }
- If valid: reason is an empty string.
- If invalid: reason is a short, friendly suggestion (under 12 words) telling the user how to make it more concrete.

Examples of VALID descriptions: "gentle rain on a window", "crackling campfire with occasional pops", "footsteps on gravel", "sword being drawn from a metal scabbard"
Examples of INVALID descriptions: "happiness", "the color blue", "asdfgh", "justice", "the passage of time"

Description: "${description.trim()}"`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text as string);
    return NextResponse.json({ valid: !!parsed.valid, reason: parsed.reason ?? "" });
  } catch {
    return NextResponse.json({ valid: true }); // fail open — don't block user on API errors
  }
}
