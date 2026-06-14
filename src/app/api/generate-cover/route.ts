import { NextRequest, NextResponse } from "next/server";

const IMAGE_STYLE = `
Visual style (apply on top of the scene — do NOT override the characters or setting):
- Dark magical nighttime palette: deep navy, indigo, and cosmic purple sky
- Pockets of warm amber or teal glow from practical light sources (lanterns, fireflies, moonbeams, glowing flowers)
- Characters are the FOCAL POINT — rendered in the foreground, warmly lit, clearly visible
- Soft painterly watercolor style with luminous brush strokes and atmospheric depth
- Rich layered background: foreground details → midground setting → starlit sky
- Mood: cozy, wondrous, safe, dreamlike — a child should feel safe looking at it
- Square composition, main characters centered with night sky above
- NO text, NO words, NO letters, NO numbers anywhere in the image`;

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

  // Build story context — combine coverPrompt + summary for richer input
  const storyContext = [
    `Key scene: ${prompt}`,
    summary ? `Story summary: ${summary}` : "",
  ].filter(Boolean).join("\n");

  // ── Step 1: ask Gemini text to write a character-specific scene description ──
  let scenePrompt = prompt; // fallback = raw coverPrompt (already story-specific)
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
              text: `You are a children's book art director. Write a 2-sentence image generation prompt for the cover of this bedtime story.

REQUIREMENTS — your prompt MUST describe:
1. The main character(s) by name with specific physical details (size, color, animal/human, what they wear or look like)
2. Exactly what action they are doing in the key emotional moment
3. The specific setting (garden, forest, bedroom, cave, etc.) with 2–3 concrete visual details
4. The lighting and mood (glowing, sparkling, moonlit, warm, etc.)

Do NOT just describe the atmosphere or sky. The characters must be clearly present in the foreground.

${storyContext}

Return ONLY the 2-sentence image prompt. No labels, no quotes, no explanation.`,
            }],
          }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 150 },
        }),
      }
    );
    if (enhanceRes.ok) {
      const enhanceData = await enhanceRes.json();
      const enhanced = enhanceData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (enhanced && enhanced.length > 20) scenePrompt = enhanced;
    }
  } catch {
    // fall back to raw coverPrompt
  }

  // ── Step 2: generate image — scene description leads, style follows ────────
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
