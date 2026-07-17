import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

// Called when the parent says "no, that's not right" to the single best-guess
// respelling from /api/name-pronunciation — asks Gemini for 5 genuinely
// different alternatives instead of one, so the parent can listen to each
// and pick whichever is actually closest. Same script-flexible reasoning as
// name-pronunciation/route.ts (this text is only ever spoken, never shown,
// so changing script is fine when it helps).
function buildAlternativesPrompt(name: string, countryCode: string | undefined, rejected: string): string {
  return [
    "You help make sure a child's name is spoken correctly by a text-to-speech voice that has no phonetic/IPA support — it can only read plain text using standard letter-sound rules for whatever script the text is written in.",
    "",
    `NAME (as typed by the parent): "${name}"`,
    countryCode ? `PARENT'S COUNTRY (ISO 3166-1 code): ${countryCode}` : "PARENT'S COUNTRY: unknown — use the name's own likely origin instead.",
    `The parent already heard this respelling and said it was WRONG: "${rejected}" — do not suggest it again.`,
    "",
    "Task: list 5 DIFFERENT respellings of this name — genuinely distinct plausible pronunciations (different stress, different vowel reading, a different regional/cultural variant, a different script if that would help a TTS voice read it correctly). Cover real alternatives a parent might actually mean, not near-duplicates of each other.",
    "",
    "Rules:",
    "- Output EXACTLY 5 lines, one respelling per line. No numbering, no explanation, no quotes, no blank lines, nothing else.",
    "- Each of the 5 must be meaningfully different from the others and from the rejected one.",
    "- This text is spoken aloud only — the parent never sees it — so pick whatever script makes each option read correctly.",
    "- Never invent a different name — only change spelling, spacing, hyphenation, or script to guide pronunciation.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let name: string, countryCode: string | undefined, rejected: string | undefined;
  try {
    ({ name, countryCode, rejected } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const trimmedName = name.trim();

  try {
    const prompt = buildAlternativesPrompt(trimmedName, countryCode, rejected?.trim() || trimmedName);
    console.log(`[name-pronunciation-alternatives] prompt:\n${prompt}`);

    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!ok) return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });

    const raw = geminiText(data);
    const alternatives = raw
      .split("\n")
      .map((line) => line.replace(/^[\s\d.\-)]+/, "").trim())
      .filter((line) => line.length > 0 && line.length <= 60)
      .slice(0, 5);

    // Never leave the UI with fewer than 5 rows — pad with the raw name for
    // anything Gemini came up short on.
    while (alternatives.length < 5) alternatives.push(trimmedName);

    console.log(`[name-pronunciation-alternatives] alternatives = ${JSON.stringify(alternatives)}`);
    return NextResponse.json({ alternatives });
  } catch (err) {
    console.error("[name-pronunciation-alternatives] error:", err);
    return NextResponse.json({ alternatives: Array(5).fill(trimmedName) });
  }
}
