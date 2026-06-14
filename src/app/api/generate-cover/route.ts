import { NextRequest, NextResponse } from "next/server";

const IMAGE_STYLE = `
Art direction: dark magical nighttime children's book illustration.
- Deep navy, indigo, and cosmic purple palette with pockets of warm amber or teal glow
- Soft painterly watercolor style — loose, luminous brush strokes
- Light sources: lanterns, fireflies, moonbeams, glowing flowers, star clusters
- Foreground characters lit warmly from below or by a magical glow source
- Rich atmospheric depth — layered background fading into a starlit sky
- Mood: cozy, wondrous, safe, dreamlike — a child can fall asleep looking at it
- Square composition, subject centered with negative space above for sky
- NO text, NO words, NO letters, NO numbers anywhere in the image`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let prompt: string;
  try {
    ({ prompt } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  // ── Step 1: ask Gemini text to expand the story hint into a vivid scene prompt ──
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
              text: `You are a children's book art director. Write a vivid, specific image generation prompt (2–3 sentences) for the cover of a bedtime story.

The prompt must:
- Name the exact characters and describe what they look like (species, size, color, expression)
- Describe what they are DOING in the key emotional scene
- Specify the setting in concrete visual detail (forest clearing, moonlit garden, cozy bedroom, etc.)
- Capture the story's emotional heart — wonder, friendship, courage, discovery

Story scene to illustrate: "${prompt}"

Return ONLY the image prompt. No explanation, no quotes, no labels.`,
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        }),
      }
    );
    const enhanceData = await enhanceRes.json();
    const enhanced = enhanceData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (enhanced) scenePrompt = enhanced;
  } catch {
    // fall back to raw prompt
  }

  // ── Step 2: generate image with scene first, style second ──────────────────
  const fullPrompt = `${scenePrompt}\n${IMAGE_STYLE}`;

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
