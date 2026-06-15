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
          generationConfig: { temperature: 0.7, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
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

  // ── Step 2: natural language prompt — character description first ────────────
  const fullPrompt = `${scenePrompt}

Illustrated in a soft watercolor style for a children's bedtime book cover. The characters described above are the main subject, large and centered in the lower two-thirds of the image, warmly lit by a gentle amber glow (from a lantern, fireflies, or glowing flowers nearby). Behind them, a soft dark indigo night sky with scattered stars forms the background — the sky fills only the upper portion and never replaces the characters. Square composition, painterly brush strokes, cozy and dreamy mood. No text, no letters, no numbers anywhere in the image.`;

  console.log("[CoverGen] Final image prompt:", fullPrompt.slice(0, 300));

  // ── Try Imagen 3 models (predict endpoint) ───────────────────────────────
  const IMAGEN_MODELS = [
    "imagen-3.0-generate-002",
    "imagen-3.0-fast-generate-001",
  ];

  for (const model of IMAGEN_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: fullPrompt }],
            parameters: { sampleCount: 1, aspectRatio: "1:1", safetyFilterLevel: "block_few" },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        console.warn(`[CoverGen] ${model} ${res.status}:`, data?.error?.message ?? JSON.stringify(data).slice(0, 200));
        continue;
      }
      const prediction = (data?.predictions ?? [])[0] as { bytesBase64Encoded?: string; mimeType?: string } | undefined;
      if (prediction?.bytesBase64Encoded) {
        console.log(`[CoverGen] Generated with ${model}`);
        return NextResponse.json({
          imageData: prediction.bytesBase64Encoded,
          mimeType: prediction.mimeType ?? "image/png",
        });
      }
      console.warn(`[CoverGen] ${model} returned no image data`);
    } catch (err) {
      console.warn(`[CoverGen] ${model} threw:`, err);
    }
  }

  // ── Fallback: Gemini generateContent with image modality ─────────────────
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
    if (res.ok) {
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          console.log("[CoverGen] Generated with gemini-2.0-flash fallback");
          return NextResponse.json({
            imageData: part.inlineData.data,
            mimeType: part.inlineData.mimeType ?? "image/jpeg",
          });
        }
      }
    }
    console.warn("[CoverGen] gemini-2.0-flash fallback:", data?.error?.message ?? "no image part");
  } catch (err) {
    console.warn("[CoverGen] gemini-2.0-flash fallback threw:", err);
  }

  return NextResponse.json({ error: "No image in response from any model" }, { status: 502 });
}
