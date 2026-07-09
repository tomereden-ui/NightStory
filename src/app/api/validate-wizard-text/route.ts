import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

type WizardField = "heroName" | "world" | "companionName" | "challenge";

const FIELD_DESCRIPTION: Record<WizardField, string> = {
  heroName: "the name of the hero of a children's bedtime story",
  world: "the setting/world a children's bedtime story takes place in",
  companionName: "the name of a companion character in a children's bedtime story",
  challenge: "the funniest or scariest thing that happens in a children's bedtime story",
};

// Kept short and kid-friendly on purpose — this is shown directly to a child
// who's mid-flow in a story wizard, not a developer-facing error message.
const LANG_NAME: Record<string, string> = {
  en: "English", he: "Hebrew", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", it: "Italian", ar: "Arabic", ja: "Japanese", hi: "Hindi",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let body: { text?: string; field?: WizardField; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const field = body.field;
  if (!text || !field || !FIELD_DESCRIPTION[field]) {
    return NextResponse.json({ error: "text and a valid field are required" }, { status: 400 });
  }

  const langName = LANG_NAME[body.language ?? "en"] ?? "English";

  const prompt = `You are a friendly content checker for a children's bedtime story creation app (ages 4-10).

A child just typed this as ${FIELD_DESCRIPTION[field]}:
"${text}"

Check TWO things:
1. Is it appropriate for a bedtime story context — no real violence, gore, sexual content, hate speech, or content that would frighten a young child beyond gentle, resolvable tension?
2. Does it make sense as an answer here — not empty, not random gibberish, not spam, not wildly off-topic for what's being asked?

If both checks pass, approve it.
If either fails, reject it and write a SHORT (one sentence), warm, encouraging message in ${langName} asking the child to try again with something else — never scold or explain exactly what was wrong, just kindly invite a new idea, in a tone a friendly bedtime-story fairy narrator would use.

Return ONLY valid JSON, no markdown, no explanation:
{"approved": true} or {"approved": false, "reason": "<short kind message in ${langName}>"}`;

  try {
    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!ok) {
      // Fail open — a Gemini hiccup shouldn't block a bedtime story from being made.
      return NextResponse.json({ approved: true });
    }
    const raw = geminiText(data).replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(raw) as { approved?: boolean; reason?: string };
    if (parsed.approved === false) {
      return NextResponse.json({ approved: false, reason: parsed.reason || "" });
    }
    return NextResponse.json({ approved: true });
  } catch (err) {
    console.warn("[validate-wizard-text] check failed, approving by default:", err);
    return NextResponse.json({ approved: true });
  }
}
