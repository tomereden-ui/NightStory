import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image";

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

  // Step 1: Gemini deeply analyzes the story and writes a precise image generation prompt
  let imagePrompt = prompt;
  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are a professional children's book cover illustrator. Analyze this story and write a precise image generation prompt for the book cover.

STORY TITLE HINT: ${prompt}
${summary ? `\nSTORY SUMMARY:\n${summary}` : ""}

Your task: Write a SINGLE image generation prompt (3-4 sentences) that will produce a stunning children's book cover. The prompt must be:

1. STORY-SPECIFIC — mention the actual characters by physical description (not name), their exact species/appearance, what they're wearing, and their emotional state in the story's key moment
2. ACTION-FOCUSED — describe the single most magical or emotionally resonant scene from the story
3. NIGHT-THEMED — the scene takes place at night or in a dreamlike setting with glowing light sources (moon, fireflies, lanterns, stars, bioluminescent glow)
4. STYLE-PRECISE — end with: "Painted children's book illustration, glowing deep-blue and teal cosmic night palette, bioluminescent rim lighting, dreamy and magical, soft flat gradients, centered square composition, no text or letters."

IMPORTANT: Only describe what is visually in the scene. No abstract concepts. Start with the characters.`,
        }],
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } },
    });
    const enhanced = geminiText(data);
    if (enhanced && enhanced.length > 30) {
      imagePrompt = enhanced;
      console.log("[CoverGen] Story-analyzed prompt:", imagePrompt.slice(0, 120));
    }
  } catch {
    console.warn("[CoverGen] Prompt analysis failed, using raw prompt");
  }

  // Step 2: Generate the cover image
  console.log("[CoverGen] Calling image model:", IMAGE_MODEL);
  try {
    const res = await fetch(
      `${GEMINI_BASE}/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      }
    );

    const raw = await res.json();

    if (!res.ok) {
      console.error("[CoverGen] API error:", JSON.stringify(raw).slice(0, 400));
      return NextResponse.json({ error: "Image generation failed", detail: raw?.error?.message }, { status: 502 });
    }

    type Part = { text?: string; inlineData?: { mimeType?: string; data?: string } };
    const parts: Part[] = raw?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      console.error("[CoverGen] No image in response. Finish reason:", raw?.candidates?.[0]?.finishReason);
      console.error("[CoverGen] Full response keys:", JSON.stringify(Object.keys(raw)));
      return NextResponse.json({ error: "No image returned", finishReason: raw?.candidates?.[0]?.finishReason }, { status: 502 });
    }

    const { mimeType = "image/png", data: b64 } = imagePart.inlineData;
    console.log("[CoverGen] Success — mimeType:", mimeType, "size:", Math.round(b64.length * 0.75 / 1024), "KB");
    return NextResponse.json({ coverUrl: `data:${mimeType};base64,${b64}` });
  } catch (err) {
    console.error("[CoverGen] Fetch error:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
