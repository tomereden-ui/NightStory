import { NextRequest, NextResponse } from "next/server";
import { geminiPost } from "@/lib/geminiClient";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ valid: true }); // fail open

  let text: string, characterName: string;
  try {
    ({ text, characterName } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!text?.trim()) {
    return NextResponse.json({ valid: false, reason: "Text cannot be empty." });
  }

  const prompt = `You are a children's story content validator. Evaluate the following script line written for a character named "${characterName ?? "Character"}".

Respond ONLY with valid JSON (no markdown): { "valid": boolean, "reason": string }
- valid: true if the text is reasonable dialogue, narration, or monologue suitable for a children's audio story.
- valid: false if the text is: random keyboard spam, purely nonsensical characters, inappropriate/adult content, or completely unrelated gibberish.
- reason: empty string if valid. If invalid, a short friendly suggestion (under 15 words) telling the user what to fix.

Be PERMISSIVE — creative, unusual, or fantastical content is fine. Only reject clear gibberish or inappropriate content.

Text: "${text.trim().slice(0, 800)}"`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    }, { callType: "validate_text" });
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(raw as string);
    return NextResponse.json({ valid: !!parsed.valid, reason: parsed.reason ?? "" });
  } catch {
    return NextResponse.json({ valid: true }); // fail open
  }
}
