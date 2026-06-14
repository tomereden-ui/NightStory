import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let prompt: string, summary: string | undefined;
  try {
    ({ prompt, summary } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const storyContext = [
    `Cover hint: ${prompt}`,
    summary ? `Full story: ${summary}` : "",
  ].filter(Boolean).join("\n");

  // ── Step 1: Gemini text → vivid character-first scene description ──────────
  let scenePrompt = prompt;
  try {
    const enhanceRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `You are a children's book illustrator writing an image prompt. Describe ONLY what a camera would see in the foreground of this book cover — the characters, their expressions, what they are doing, and where they are standing.

RULES:
- START with the main character(s): their species/appearance, clothing or fur color, size, emotion
- Then describe the action they are doing right now (playing, hugging, reaching, looking at something)
- Then the setting behind them (garden path, cozy bedroom, forest clearing, etc.) with 2 specific details
- End with one lighting detail (warm glow from a lantern, soft moonlight falling on them, firefly light, etc.)
- DO NOT mention the sky, clouds, or moon as the subject — they may exist in the background only
- DO NOT write about atmosphere without characters in it
- 3 sentences maximum

${storyContext}

Write ONLY the image prompt. No labels, no quotes.`,
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        }),
      }
    );
    if (enhanceRes.ok) {
      const enhanceData = await enhanceRes.json();
      const enhanced = enhanceData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (enhanced && enhanced.length > 20) {
        scenePrompt = enhanced;
        console.log("[CoverGen] Enhanced scene prompt:", scenePrompt);
      }
    }
  } catch {
    console.warn("[CoverGen] Enhancement failed, using raw prompt");
  }

  // ── Step 2: build final prompt — characters first, style wraps around ──────
  const fullPrompt = `Children's book cover illustration.

FOREGROUND SUBJECT (draw this first, largest, most detailed):
${scenePrompt}

REQUIRED: The characters above MUST be the primary subject filling the lower 2/3 of the image. They must be clearly visible, warmly lit, and rendered with expressive detail.

ART STYLE: Soft watercolor painting, luminous brush strokes, painterly depth. Warm amber or teal glow from a nearby light source (lantern, fireflies, glowing flowers) illuminating the characters from the front. Background fades into a soft dark indigo night with scattered stars — background stays behind characters, never replacing them.

AVOID: empty sky as the main subject, plain moon without characters, atmospheric-only compositions with no characters visible, landscapes without the story characters present.

NO text, NO words, NO letters, NO numbers anywhere in the image. Square composition.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return NextResponse.json({
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/jpeg",
        });
      }
    }
    return NextResponse.json({ error: "No image in response" }, { status: 502 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
