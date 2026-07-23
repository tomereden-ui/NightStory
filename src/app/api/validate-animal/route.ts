import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

// Kept short and kid-friendly on purpose — this is shown directly to a child
// who's mid-flow in a story wizard, not a developer-facing error message.
const LANG_NAME: Record<string, string> = {
  en: "English", he: "Hebrew", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", it: "Italian", ar: "Arabic", ja: "Japanese", hi: "Hindi",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let body: { text?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const langName = LANG_NAME[body.language ?? "en"] ?? "English";

  const prompt = `You are a friendly content checker for a children's bedtime story creation app (ages 4-10).

A child just typed this, hoping it names an animal they want as the hero of their story:
"${text}"

Check TWO things:
1. Does it name a real-world animal OR a well-known animal-like creature from folklore/fantasy that a child would recognize (e.g. "dragon" or "unicorn" are fine; a random made-up word or a non-animal object/person is not)? Minor typos or the word in any language are fine as long as you can tell which animal they mean.
2. Is it appropriate for a bedtime story context — nothing violent, scary beyond gentle/resolvable, or otherwise unsuitable for a young child?

If both checks pass, approve it and also return:
- "animalEnglish": the animal's common name as a single lowercase English word or short phrase (e.g. "penguin", "sea turtle") — this is used internally, never shown to the child.
- "emoji": ONE single emoji character that best represents this animal.
- "names": an array of exactly 4 short, fun, kid-friendly proper-noun NAME suggestions for a character of this animal (e.g. for a penguin: "Waddles", "Percy", "Chilly", "Bubbles"). These stay as English-style names regardless of the reply language, matching this app's existing naming convention.

If it fails check 1 (not recognizable as an animal): write a SHORT (one sentence), warm message in ${langName} that doesn't scold — just gently asks what animal they meant, in the tone of a friendly bedtime-story fairy narrator.

If it fails check 2 (inappropriate): write a SHORT (one sentence) warm message in ${langName} that kindly invites a different animal idea, without explaining exactly what was wrong.

Return ONLY valid JSON, no markdown, no explanation:
{"approved": true, "animalEnglish": "...", "emoji": "...", "names": ["...", "...", "...", "..."]}
or
{"approved": false, "reason": "<short message in ${langName}>"}`;

  try {
    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    }, { callType: "validate_animal" });
    if (!ok) {
      // Fail closed here (unlike the general text checker) — approving
      // unconditionally would let a non-animal word slip through with no
      // name suggestions to show, breaking the very next screen.
      return NextResponse.json({ approved: false, reason: "" });
    }
    const raw = geminiText(data).replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(raw) as { approved?: boolean; reason?: string; animalEnglish?: string; emoji?: string; names?: unknown };
    if (parsed.approved === false) {
      return NextResponse.json({ approved: false, reason: parsed.reason || "" });
    }
    const names = Array.isArray(parsed.names)
      ? parsed.names.map((n) => String(n).trim()).filter(Boolean).slice(0, 4)
      : [];
    return NextResponse.json({
      approved: true,
      animalEnglish: (parsed.animalEnglish || text).toLowerCase().trim(),
      emoji: parsed.emoji || "🐾",
      names,
    });
  } catch (err) {
    console.warn("[validate-animal] check failed:", err);
    return NextResponse.json({ approved: false, reason: "" });
  }
}
