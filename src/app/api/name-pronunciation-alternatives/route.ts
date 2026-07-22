import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

// Called when the parent says "no, that's not right" to the single best-guess
// respelling from /api/name-pronunciation — asks Gemini for 5 genuinely
// different alternatives instead of one, so the parent can listen to each
// and pick whichever is actually closest. Same script-flexible reasoning as
// name-pronunciation/route.ts (this text is only ever spoken, never shown,
// so changing script is fine when it helps).
function buildAlternativesPrompt(name: string, countryCode: string | undefined, rejected: string[]): string {
  const rejectedList = rejected.map((r) => `"${r}"`).join(", ");
  return [
    "You help make sure a child's name is spoken correctly by a text-to-speech voice that has no phonetic/IPA support — it can only read plain text using standard letter-sound rules for whatever script the text is written in.",
    "",
    `NAME (as typed by the parent): "${name}"`,
    countryCode ? `PARENT'S COUNTRY (ISO 3166-1 code): ${countryCode}` : "PARENT'S COUNTRY: unknown — use the name's own likely origin instead.",
    `The parent already heard ${rejected.length > 1 ? "these respellings" : "this respelling"} and said ${rejected.length > 1 ? "none were" : "it was"} right: ${rejectedList} — do not suggest ${rejected.length > 1 ? "any of them" : "it"} again.`,
    "",
    "Task: list 5 DIFFERENT respellings of this name — genuinely distinct plausible pronunciations (different stress, different vowel reading, a different regional/cultural variant, a different script if that would help a TTS voice read it correctly). Cover real alternatives a parent might actually mean, not near-duplicates of each other.",
    "",
    "For each of the 5, output one line in exactly this format:",
    "<TTS-RESPELLING>|||<READABLE-PHONETIC>",
    "",
    "Where:",
    "- TTS-RESPELLING is the text actually sent to the TTS engine — script-flexible, whatever reads most accurately.",
    "- READABLE-PHONETIC is a plain-English phonetic spelling a parent can silently read and understand at a glance — always Latin letters, capitalize the stressed syllable, hyphenate syllables (e.g. \"NOH-ahm\", \"no-AHM\"). This is shown on screen, so it must always be readable even when TTS-RESPELLING uses a different script.",
    "",
    "Rules:",
    "- Output EXACTLY 5 lines in that pipe-separated format. No numbering, no explanation, no extra quotes, no blank lines, nothing else.",
    "- Each of the 5 must be meaningfully different from the others and from every already-rejected option.",
    "- Never invent a different name — only change spelling, spacing, hyphenation, or script to guide pronunciation.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  // `rejected` may be a single respelling (first "not quite") or an array
  // (asking for a further round, so every option already shown gets excluded).
  let name: string, countryCode: string | undefined, rejected: string | string[] | undefined;
  try {
    ({ name, countryCode, rejected } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const trimmedName = name.trim();
  const rejectedList = (Array.isArray(rejected) ? rejected : rejected ? [rejected] : [trimmedName])
    .map((r) => r.trim())
    .filter(Boolean);

  try {
    const prompt = buildAlternativesPrompt(trimmedName, countryCode, rejectedList.length ? rejectedList : [trimmedName]);
    console.log(`[name-pronunciation-alternatives] prompt:\n${prompt}`);

    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!ok) return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });

    const raw = geminiText(data);
    const alternatives = raw
      .split("\n")
      .map((line) => line.replace(/^[\s\d.\-)]+/, "").trim())
      .filter((line) => line.length > 0 && line.length <= 120)
      .slice(0, 5)
      .map((line) => {
        const [textPart, readablePart] = line.split("|||").map((p) => p?.trim());
        // Gemini occasionally drops the "|||" separator — fall back to
        // showing the respelling itself rather than losing the row.
        return { text: textPart || trimmedName, readable: readablePart || textPart || trimmedName };
      });

    // Never leave the UI with fewer than 5 rows — pad with the raw name for
    // anything Gemini came up short on.
    while (alternatives.length < 5) alternatives.push({ text: trimmedName, readable: trimmedName });

    console.log(`[name-pronunciation-alternatives] alternatives = ${JSON.stringify(alternatives)}`);
    return NextResponse.json({ alternatives });
  } catch (err) {
    console.error("[name-pronunciation-alternatives] error:", err);
    return NextResponse.json({ alternatives: Array(5).fill({ text: trimmedName, readable: trimmedName }) });
  }
}
