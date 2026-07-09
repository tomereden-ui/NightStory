import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  friend: "best friend",
  pet: "pet animal",
  creature: "magical creature",
  family: "family member",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ names: [] });

  let companionType: string, heroName: string, worldName: string;
  try {
    ({ companionType, heroName, worldName } = await req.json());
  } catch {
    return NextResponse.json({ names: [] });
  }

  const label = TYPE_LABELS[companionType] ?? companionType;
  const heroContext = heroName ? `The hero is ${heroName}` : "a young hero";
  const worldContext = worldName ? `in ${worldName}` : "in a magical world";

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `Suggest 4 short, memorable names for a ${label} companion in a children's bedtime story. ${heroContext} ${worldContext}. Names should be warm, whimsical, and easy for young children to pronounce. Return ONLY a JSON array of 4 name strings, nothing else. Example format: ["Pip", "Ember", "Nova", "Wisp"]`,
        }],
      }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 60,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = geminiText(data);
    if (text) {
      const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      const names = JSON.parse(clean) as unknown;
      if (Array.isArray(names) && names.length > 0) {
        return NextResponse.json({ names: (names as string[]).slice(0, 4) });
      }
    }
  } catch { /* graceful: caller falls back to hardcoded names */ }

  return NextResponse.json({ names: [] });
}
