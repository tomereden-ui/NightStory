import { NextRequest, NextResponse } from "next/server";

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
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(raw);
    return NextResponse.json({ valid: !!parsed.valid, reason: parsed.reason ?? "" });
  } catch {
    return NextResponse.json({ valid: true }); // fail open
  }
}
