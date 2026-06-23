import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

  // Step 1: Gemini text → vivid character-first scene description
  let scenePrompt = prompt;
  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
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
    });
    const enhanced = geminiText(data);
    if (enhanced && enhanced.length > 20) scenePrompt = enhanced;
  } catch {
    console.warn("[CoverGen] Gemini text enhancement failed, using raw prompt");
  }

  const fullPrompt = `${scenePrompt}

Illustrated as a glowing monochromatic blue-and-teal cosmic night scene for a children's bedtime book cover. The characters/subject described above are large and centered, rendered as a soft silhouette or gently lit shape glowing from within against a deep navy-black night sky. Scattered stars and a faint nebula-like glow surround the subject. Square composition, dreamy bioluminescent lighting, smooth gradients, minimal flat illustration style — no warm or amber tones, only cool blues, teals, and indigo. No text, no letters, no numbers anywhere in the image.`;

  console.log("[CoverGen] Generating image with Gemini for prompt:", scenePrompt.slice(0, 80));

  // Step 2: Gemini image generation
  try {
    const res = await fetch(
      `${GEMINI_BASE}/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], temperature: 1.0 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("[CoverGen] Gemini image generation failed:", JSON.stringify(err).slice(0, 300));
      return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
    }

    const data = await res.json();
    type Part = { text?: string; inlineData?: { mimeType?: string; data?: string } };
    const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      console.error("[CoverGen] No image in Gemini response:", JSON.stringify(data).slice(0, 400));
      return NextResponse.json({ error: "No image returned" }, { status: 502 });
    }

    const { mimeType = "image/png", data: b64 } = imagePart.inlineData;
    const coverUrl = `data:${mimeType};base64,${b64}`;
    console.log("[CoverGen] Image generated successfully");
    return NextResponse.json({ coverUrl });
  } catch (err) {
    console.error("[CoverGen] Image generation error:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
