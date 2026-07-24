import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import { recordGeminiImageUsage } from "@/lib/serviceUsage";
import { COVER_FALLBACK_PROMPT, buildCoverRewriterPrompt } from "@/config/coverImageInstructions";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image";

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let prompt: string, summary: string | undefined, storyId: string | undefined;
  try {
    ({ prompt, summary, storyId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  // Step 1: Rewrite the story hint into a safe, fantastical image prompt
  let imagePrompt = prompt;
  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{
        role: "user",
        parts: [{ text: buildCoverRewriterPrompt(prompt, summary) }],
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 220, thinkingConfig: { thinkingBudget: 0 } },
    }, { callType: "cover_prompt_rewrite", storyId });
    const enhanced = geminiText(data);
    if (enhanced && enhanced.length > 30) {
      imagePrompt = enhanced;
      console.log("[CoverGen] Story-analyzed prompt:", imagePrompt.slice(0, 120));
    }
  } catch {
    console.warn("[CoverGen] Prompt analysis failed, using raw prompt");
  }

  // Step 2: Generate the cover image — retry with generic fallback on PROHIBITED_CONTENT
  async function callImageModel(promptText: string) {
    const res = await fetch(
      `${GEMINI_BASE}/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
          safetySettings: SAFETY_SETTINGS,
        }),
      }
    );
    return { res, raw: await res.json() };
  }

  console.log("[CoverGen] Calling image model:", IMAGE_MODEL);
  try {
    let { res, raw } = await callImageModel(imagePrompt);

    if (raw?.candidates?.[0]?.finishReason === "PROHIBITED_CONTENT") {
      console.warn("[CoverGen] PROHIBITED_CONTENT — retrying with generic fallback prompt");
      ({ res, raw } = await callImageModel(COVER_FALLBACK_PROMPT));
    }

    if (!res.ok) {
      console.error("[CoverGen] API error:", JSON.stringify(raw).slice(0, 400));
      return NextResponse.json({ error: "Image generation failed", detail: raw?.error?.message }, { status: 502 });
    }

    type Part = { text?: string; inlineData?: { mimeType?: string; data?: string } };
    const parts: Part[] = raw?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: Part) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      console.error("[CoverGen] No image in response. Finish reason:", raw?.candidates?.[0]?.finishReason);
      return NextResponse.json({ error: "No image returned", finishReason: raw?.candidates?.[0]?.finishReason }, { status: 502 });
    }

    const { mimeType = "image/png", data: b64 } = imagePart.inlineData;
    console.log("[CoverGen] Success — mimeType:", mimeType, "size:", Math.round(b64.length * 0.75 / 1024), "KB");
    recordGeminiImageUsage({ callType: "cover_image", storyId }, { model: IMAGE_MODEL }).catch(() => {});
    return NextResponse.json({ coverUrl: `data:${mimeType};base64,${b64}` });
  } catch (err) {
    console.error("[CoverGen] Fetch error:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
