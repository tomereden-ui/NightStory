import { NextRequest, NextResponse } from "next/server";

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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return NextResponse.json({ valid: !!parsed.valid, reason: parsed.reason ?? "" });
  } catch {
    return NextResponse.json({ valid: true }); // fail open — don't block user on API errors
  }
}
