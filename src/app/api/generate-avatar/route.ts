import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import { findBestAvatar } from "@/lib/services/avatarBankService";

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
  let portraitDesc = `a children's story character, expressive face, wide eyes, dreamy look`;
  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are a children's book illustrator writing a character description for avatar matching.
Write 1 sentence in ENGLISH ONLY describing the character named "${characterName}".

Story context: ${summary ?? "a magical bedtime adventure"}

Include ONLY: age (child/young/middle-aged/elderly), species (human/animal type), gender, hair/fur color, eye color, and one personality trait visible in the expression.
Do NOT include the character's name. Do NOT use non-Latin characters.
Example: "7 year old girl, curly red hair, bright green eyes, wearing a blue cloak, brave and curious expression"`,
        }],
      }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = geminiText(data);
    if (text && text.length > 20) portraitDesc = text.trim();
  } catch {
    console.warn("[AvatarGen] Gemini description failed, using fallback");
  }

  // Step 2: find closest avatar from the pre-seeded bank
  const avatarUrl = await findBestAvatar(portraitDesc, apiKey);

  console.log("[AvatarGen]", characterName, "→", portraitDesc.slice(0, 60), "→", avatarUrl ? "bank hit" : "no match");
  return NextResponse.json({ avatarUrl });
}
