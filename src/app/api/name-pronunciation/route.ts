import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

// Onboarding lets a parent hear their child's name spoken back before saving
// it — this asks Gemini for a phonetic respelling biased toward the likely
// pronunciation in the parent's country (from IP geolocation), then
// /api/synthesize-speech reads THAT respelling aloud instead of the raw
// typed name. There's no SSML/phoneme support in the TTS pipeline (see
// synthesize-speech/route.ts), so a same-script respelling is the only
// lever available — e.g. "Xiomara" respelled "Shomara" for an
// English-reading TTS voice, or hyphenation to force a syllable break.
function buildPronunciationPrompt(name: string, countryCode?: string): string {
  return [
    "You help make sure a child's name is spoken correctly by a text-to-speech voice.",
    "",
    `NAME (as typed by the parent): "${name}"`,
    countryCode ? `PARENT'S COUNTRY (ISO 3166-1 code): ${countryCode}` : "PARENT'S COUNTRY: unknown — use the name's own likely origin instead.",
    "",
    "Task: write a phonetic respelling of this name so a generic text-to-speech engine reading it aloud produces the name's most natural, likely pronunciation for a family from that country.",
    "",
    "Rules:",
    "- Output ONLY the respelled name. No explanation, no quotes, no extra words.",
    "- Keep the exact same alphabet/script as the input (Latin stays Latin, Hebrew stays Hebrew, Arabic stays Arabic, etc.) — never transliterate into a different script.",
    "- If the name is already spelled the way it's naturally pronounced, return it completely unchanged.",
    "- Only adjust spelling, spacing, or hyphenation to guide pronunciation — never invent a different name.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let name: string, countryCode: string | undefined;
  try {
    ({ name, countryCode } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: buildPronunciationPrompt(name.trim(), countryCode) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 40, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!ok) return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });

    const respelling = geminiText(data);
    // Fall back to the raw name for anything degenerate — empty, way too
    // long for a name, or a refusal ("I cannot...") slipping through.
    const pronunciation = respelling && respelling.length <= 60 ? respelling : name.trim();
    return NextResponse.json({ pronunciation });
  } catch (err) {
    console.error("[name-pronunciation] error:", err);
    return NextResponse.json({ pronunciation: name.trim() });
  }
}
