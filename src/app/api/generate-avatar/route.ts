import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let characterName: string, summary: string | undefined;
  try {
    ({ characterName, summary } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!characterName) return NextResponse.json({ error: "characterName required" }, { status: 400 });

  // Step 1: Gemini writes a vivid portrait description of the character
  let portraitDesc = `a young children's book character, expressive face, wide eyes, dreamy look`;
  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are a children's book illustrator writing an image generation prompt for a character named "${characterName}".

Story context: ${summary ?? "a magical bedtime adventure"}

Write a portrait description in ENGLISH ONLY (even if the character name is in another language).
Describe ONLY the character's face and upper body in 2 sentences:
- Their age, species (human/animal/etc.), hair or fur color, eye color, and one unique feature
- Their emotional expression in this story (e.g. wide-eyed wonder, gentle sleepiness, brave curiosity)
- What they are wearing (one detail only)

IMPORTANT: Use ONLY English words. Do NOT include the character's name. Do NOT use any non-Latin characters.
Do NOT describe backgrounds, other characters, or scenery. Write ONLY the portrait description.`,
        }],
      }],
      generationConfig: { temperature: 0.65, maxOutputTokens: 100, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = geminiText(data);
    if (text && text.length > 20) {
      portraitDesc = text;
      console.log("[AvatarGen] Portrait desc:", portraitDesc);
    }
  } catch {
    console.warn("[AvatarGen] Gemini enhancement failed, using fallback");
  }

  // Return the full prompt; the browser will fetch Pollinations directly (avoids shared server-IP rate limiting)
  const fullPrompt = `${portraitDesc}

Soft children's book illustration, circular avatar portrait, glowing blue-teal-indigo night palette, gentle bioluminescent rim light, dreamy and magical, smooth flat gradients, face centered and large, painted portrait style — no text, no letters, no background clutter.`;

  console.log("[AvatarGen] Returning prompt for:", characterName);
  return NextResponse.json({ prompt: fullPrompt });
}
