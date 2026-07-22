import { NextRequest, NextResponse } from "next/server";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";

// Onboarding lets a parent hear their child's name spoken back before saving
// it — this asks Gemini for a phonetic respelling biased toward the likely
// pronunciation in the parent's country (from IP geolocation), then
// /api/synthesize-speech reads THAT respelling aloud instead of the raw
// typed name.
//
// There's no SSML/phoneme support in the TTS pipeline (see
// synthesize-speech/route.ts) — AND (confirmed by reading ttsService.ts)
// the `language` field passed to that endpoint never actually reaches
// Gemini's TTS call itself; synthesizeGemini() accepts it as a parameter
// but never references it. Gemini's TTS model gets ONLY the raw text and
// infers pronunciation purely from its script/spelling — there is no other
// lever. So a Hebrew-origin name typed in Latin letters ("Maya") gets read
// with English-biased pronunciation, because nothing tells the model it
// should sound Hebrew instead. The fix: let the respelling change script
// when that's what the target pronunciation actually calls for (Hebrew
// script for a Hebrew name, Cyrillic for a Russian one, etc.) — this text
// is NEVER shown to the parent, only spoken, so a script change here has no
// downside the way it would if it were displayed.
function buildPronunciationPrompt(name: string, countryCode?: string): string {
  return [
    "You help make sure a child's name is spoken correctly by a text-to-speech voice that has no phonetic/IPA support — it can only read plain text using standard letter-sound rules for whatever script the text is written in.",
    "",
    `NAME (as typed by the parent): "${name}"`,
    countryCode ? `PARENT'S COUNTRY (ISO 3166-1 code): ${countryCode}` : "PARENT'S COUNTRY: unknown — use the name's own likely origin instead.",
    "",
    "Task: write a respelling of this name that, when read aloud by that TTS voice using standard letter-sound rules, produces the name's most natural, likely pronunciation for a family from that country.",
    "",
    "Output exactly one line in this format:",
    "<TTS-RESPELLING>|||<READABLE-PHONETIC>",
    "",
    "Where:",
    "- TTS-RESPELLING is the text actually sent to the TTS engine — script-flexible, whatever reads most accurately. If the country's dominant language uses a different script than the name was typed in (e.g. a Hebrew-origin name typed in Latin letters, for a parent in Israel), prefer respelling it in THAT script over trying to force the sound through Latin-letter tricks, which can't represent every sound. If the name is already spelled the way it's naturally pronounced in a script that will read correctly, return it completely unchanged.",
    "- READABLE-PHONETIC is a plain-English phonetic spelling a parent can silently read and understand at a glance — always Latin letters, capitalize the stressed syllable, hyphenate syllables (e.g. \"NOH-ahm\", \"no-AHM\"). This is shown on screen, so it must always be readable even when TTS-RESPELLING uses a different script.",
    "",
    "Rules:",
    "- Output ONLY that one pipe-separated line. No explanation, no quotes, no extra words.",
    "- Never invent a different name — only change spelling, spacing, hyphenation, or script to guide pronunciation.",
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
    const prompt = buildPronunciationPrompt(name.trim(), countryCode);
    console.log(`[name-pronunciation] prompt:\n${prompt}`);

    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 60, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!ok) return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });

    const raw = geminiText(data);
    const [respellingPart, readablePart] = raw.split("|||").map((p) => p?.trim());
    // Fall back to the raw name for anything degenerate — empty, way too
    // long for a name, or a refusal ("I cannot...") slipping through.
    const pronunciation = respellingPart && respellingPart.length <= 60 ? respellingPart : name.trim();
    const readable = readablePart && readablePart.length <= 60 ? readablePart : pronunciation;
    console.log(`[name-pronunciation] pronunciation = "${pronunciation}" readable = "${readable}" (name="${name.trim()}", countryCode=${countryCode ?? "unknown"})`);
    return NextResponse.json({ pronunciation, readable });
  } catch (err) {
    console.error("[name-pronunciation] error:", err);
    console.log(`[name-pronunciation] pronunciation = "${name.trim()}" (fallback — Gemini call failed)`);
    return NextResponse.json({ pronunciation: name.trim(), readable: name.trim() });
  }
}
