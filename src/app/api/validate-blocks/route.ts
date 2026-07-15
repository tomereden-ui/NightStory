import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "@/lib/usageTracker";
import { detectGeneratedLanguage } from "@/lib/services/scriptGenerationHelpers";
import type { ScriptBlock } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Same external-guidance pattern as validate-script (config/story-guidance.txt)
// and the Hebrew letter check (config/hebrew-letter-check.txt) — the actual
// review criteria live in a plain-text file editable without touching code.
// {{AGE}} is filled in per-request since the reviewed age varies per story.
function readGuidance(age: number): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "config", "validate-blocks-guidance.txt"), "utf-8");
    return raw.replace(/\{\{AGE\}\}/g, String(age));
  } catch {
    return "";
  }
}

function readGrammarPassGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "validate-blocks-grammar-pass.txt"), "utf-8");
  } catch {
    return "";
  }
}

function readHebrewPassGuidance(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "validate-blocks-hebrew-pass.txt"), "utf-8");
  } catch {
    return "";
  }
}

// Strips a block's leading [performance tag] and returns both pieces —
// shared by pass 1 and pass 2 since both need the same tag-hold-and-
// reattach handling around whatever Gemini returns.
function stripTag(textPayload: string): { tag: string; bareText: string } {
  const tagMatch = textPayload.match(/^(\[[^\]]+\]\s*)/);
  return tagMatch ? { tag: tagMatch[1], bareText: textPayload.slice(tagMatch[1].length) } : { tag: "", bareText: textPayload };
}

type IndexedTextBlock = { _idx: number; characterName: string; tag: string; bareText: string };

// Runs one Gemini review pass and merges any fixes directly into
// resultBlocks (mutated in place). Failure in one pass never discards a
// fix another pass already made — resultBlocks starts as a copy of the
// original blocks, so a total failure across every pass still degrades to
// the safe "nothing changed" result.
async function runReviewPass(
  genAI: GoogleGenerativeAI,
  promptText: string,
  passBlocks: IndexedTextBlock[],
  resultBlocks: ScriptBlock[],
  passLabel: string,
): Promise<number> {
  let changes = 0;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } },
    });
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    const validated = JSON.parse(jsonStr) as { index: number; text: string; status: "ok" | "fixed" }[];

    for (const item of validated) {
      const original = passBlocks[item.index];
      if (!original || item.status !== "fixed" || !item.text?.trim()) continue;
      // Gemini never saw the tag (stripped before the prompt was built), so
      // its reply is always bare spoken text — just re-prepend the tag we
      // held onto, no detection needed.
      const newText = `${original.tag}${item.text.trim()}`;
      resultBlocks[original._idx] = { ...resultBlocks[original._idx], textPayload: newText };
      console.log(`[validate-blocks][${passLabel}] Fixed "${original.characterName}" — before: ${JSON.stringify(original.bareText)} | after: ${JSON.stringify(item.text.trim())}`);
      changes++;
    }
  } catch (err) {
    console.warn(`[validate-blocks][${passLabel}] failed, keeping prior result:`, err);
  }
  return changes;
}

type HebrewFlag = { characterName: string; originalText: string; index?: number; status?: string; correction?: string; reason?: string };

// The Hebrew pass's guidance dictates its own response format (a structured
// text block per flagged line, not JSON — see the "Output Format for Flags"
// section of validate-blocks-hebrew-pass.txt), since it needed a Reason
// field a bare JSON array doesn't have. Parses that format: each flagged
// entry starts with a "[Character Name] Original text" header line,
// followed by "- Field: value" lines until the next header or end of text.
//
// Gemini does not reliably follow the guidance's literal "[Name] text"
// bracket template — live runs came back as "Name: text" and bare
// "Name text" just as often (confirmed: 4 of 5 trials against the exact
// same prompt used something other than brackets). A strict bracket regex
// silently parsed zero records on those runs even though the correction
// itself was right. Anchoring on the known character names we sent, instead
// of trusting Gemini's punctuation, works regardless of which format it
// picks this time.
//
// Two more drift variants confirmed live (a real run returned ZERO parsed
// records despite Gemini computing every correction correctly): (1) the
// header on its OWN line — "[Name]" alone, with the original text on a
// separate (sometimes ```-fenced) line below instead of the same line —
// which neither the "name + trailing text" nor the "line === name" branch
// below matched; (2) "* Status:"/"* Correction:" markdown bullets instead
// of "- Status:". Both are handled below; ``` fence lines are skipped
// outright since they carry no field/name content of their own.
function parseHebrewPassFlags(raw: string, knownNames: string[]): HebrewFlag[] {
  const records: HebrewFlag[] = [];
  let current: HebrewFlag | null = null;
  // Longest-first so a name that's a prefix of another can't shadow it.
  const sortedNames = Array.from(new Set(knownNames)).sort((a, b) => b.length - a.length);
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^```/.test(line)) continue;

    // Tolerates "- Field:", "* Field:", "**Field:**", or no bullet at all.
    const field = line.match(/^[-*]?\s*\**\s*(Index|Status|Correction|Reason)\s*\**\s*:\s*(.+)$/i);
    if (field && current) {
      const [, key, value] = field;
      if (/^index$/i.test(key)) current.index = Number(value.trim());
      else if (/^status$/i.test(key)) current.status = value.trim();
      else if (/^correction$/i.test(key)) current.correction = value.trim();
      else if (/^reason$/i.test(key)) current.reason = value.trim();
      continue;
    }

    const matchedName = sortedNames.find((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^\\[?${escaped}\\]?\\s*:?\\s`).test(line)
        || line === name
        // "[Name]" alone on its line, nothing trailing (text follows below).
        || new RegExp(`^\\[${escaped}\\]$`).test(line);
    });
    if (matchedName) {
      if (current) records.push(current);
      const rest = line.replace(new RegExp(`^\\[?${matchedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]?\\s*:?\\s*`), "").trim();
      current = { characterName: matchedName, originalText: rest };
      continue;
    }

    // A non-empty, non-field, non-header line while a record is open and
    // still missing its original text — the "[Name]" alone / fenced-text
    // case: append it (the app never trusts originalText for anything but
    // a fallback match, so a slightly imprecise multi-line join is fine).
    if (current && !current.originalText) {
      current.originalText = line;
    }
  }
  if (current) records.push(current);
  return records;
}

// Hebrew-only third cycle: nikkud/grammar + root-letter proofreading, using
// config/validate-blocks-hebrew-pass.txt's own response format rather than
// the shared runReviewPass JSON shape. Plain-text generation (no
// responseMimeType) since the guidance's format isn't JSON.
async function runHebrewPass(
  genAI: GoogleGenerativeAI,
  promptText: string,
  passBlocks: IndexedTextBlock[],
  resultBlocks: ScriptBlock[],
): Promise<number> {
  let changes = 0;
  try {
    // Pro, not flash: confirmed live that flash can miss a subtle nikkud
    // pattern (bare Kamats Katan in כָּל) even right next to another fix it
    // DID catch in the same block, while pro-preview catches both reliably
    // on the identical prompt — this narrow, quality-sensitive final gate is
    // worth the extra latency/cost that the rest of the app's flash-only
    // passes avoid.
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 4096 } },
    });
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const records = parseHebrewPassFlags(result.response.text(), passBlocks.map((b) => b.characterName));
    for (const record of records) {
      if (!record.correction || (record.status && !/fixed/i.test(record.status))) continue;
      // Trust the index Gemini was asked to echo back, but only if it
      // actually points at the character it claimed to flag — falls back to
      // a name+text match (and finally just name) for a mismatched index.
      const original =
        (record.index !== undefined && passBlocks[record.index]?.characterName === record.characterName ? passBlocks[record.index] : undefined) ??
        passBlocks.find((b) => b.characterName === record.characterName && b.bareText.trim() === record.originalText.trim()) ??
        passBlocks.find((b) => b.characterName === record.characterName);
      if (!original) {
        console.warn(`[validate-blocks][pass3-hebrew] Could not match flagged block for "${record.characterName}" — skipping`);
        continue;
      }
      const newText = `${original.tag}${record.correction.trim()}`;
      resultBlocks[original._idx] = { ...resultBlocks[original._idx], textPayload: newText };
      console.log(`[validate-blocks][pass3-hebrew] Fixed "${original.characterName}" — before: ${JSON.stringify(original.bareText)} | after: ${JSON.stringify(record.correction.trim())}${record.reason ? ` | reason: ${record.reason}` : ""}`);
      changes++;
    }
  } catch (err) {
    console.warn("[validate-blocks][pass3-hebrew] failed, keeping prior result:", err);
  }
  return changes;
}

// Deterministic backstop for the single highest-frequency Kamats Katan
// trigger named in config/validate-blocks-hebrew-pass.txt: bare-Kamats כָּל
// ("all/every") must always read as כּוֹל, in every position including
// inside כּוֹל כָּךְ. Confirmed live that the LLM pass, even after fixing an
// unrelated issue in the very same line, sometimes still misses this one
// occurrence — so this runs unconditionally after the LLM pass rather than
// relying solely on its recall. Only touches the vowel; whatever dagesh
// state (or lack of one) the text already has on the כ is preserved as-is,
// since forcing one on/off after certain prefixes is its own linguistic can
// of worms. Deliberately does NOT touch כָּךְ (different final letter, ך not
// ל) or already-corrected כּוֹל.
const BARE_KAMATS_KOL_RE = /(?<![א-ת])כ(ּ?)ָ(ּ?)ל(?![א-ת])/g;
function applyDeterministicHebrewFixes(text: string): string {
  return text.replace(BARE_KAMATS_KOL_RE, (_m, d1, d2) => `כ${d1 || d2}וֹל`);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let blocks: ScriptBlock[], age: number, lessons: string[], summary: string;
  try {
    ({ blocks, age = 6, lessons = [], summary = "" } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!blocks?.length) return NextResponse.json({ blocks: [] });

  // SFX blocks need no text validation — pass them straight through.
  const textBlocks: IndexedTextBlock[] = blocks
    .map((b, i) => ({ _idx: i, characterName: b.characterName, ...stripTag(b.textPayload) }))
    .filter((b) => b.characterName !== "SFX");

  if (textBlocks.length === 0) {
    return NextResponse.json({ blocks, changes: 0 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const resultBlocks = [...blocks];
  let changes = 0;

  // Kicked off now so it overlaps with pass 1/2's latency instead of adding
  // to it — the script's language never changes between passes, so there's
  // no reason to wait until after they finish to start detecting it.
  const languagePromise = detectGeneratedLanguage(
    textBlocks.map((b) => ({ characterName: b.characterName, textPayload: b.bareText })),
    apiKey,
  ).catch(() => "en");

  // ── Pass 1: combined age/content/grammar review ────────────────────────
  const pass1Prompt = `You are a children's content safety and language quality reviewer for a bedtime story app.

CHILD AGE: ${age} years old
STORY LESSONS: ${lessons.length ? lessons.join(", ") : "none specified"}
STORY SUMMARY: ${summary || "not provided"}

${readGuidance(age)}

Return ONLY a valid JSON array containing ONLY the blocks you fixed — no markdown, no explanation:
[{"index":1,"text":"the corrected spoken text","status":"fixed"},...]

Return an empty array [] if every block is already fine. Never echo blocks that needed no change — the app keeps unlisted blocks exactly as they are.

BLOCKS:
${textBlocks.map((b, i) => `[${i}] ${b.characterName}: ${JSON.stringify(b.bareText)}`).join("\n")}`;
  changes += await runReviewPass(genAI, pass1Prompt, textBlocks, resultBlocks, "pass1-content");

  // ── Pass 2: dedicated grammar/typo-only proofread ───────────────────────
  // Pass 1 judges age-appropriateness AND grammar in one shot, and can miss
  // a typo that co-occurs in a block it's already busy rewriting for content
  // — measured live: a real Hebrew script had a missing-letter typo survive
  // 8/8 trials when a tone edit landed in the same block, but a fully
  // separate grammar-only pass (no competing content framing) caught it
  // 3/3. Re-proofreads pass 1's own output (not the original text), so a
  // block flagged by both passes gets both fixes instead of one overwriting
  // the other.
  const pass2Blocks: IndexedTextBlock[] = resultBlocks
    .map((b, i) => ({ _idx: i, characterName: b.characterName, ...stripTag(b.textPayload) }))
    .filter((b) => b.characterName !== "SFX");
  const pass2Prompt = `${readGrammarPassGuidance()}

Return ONLY a valid JSON array containing ONLY the blocks you fixed — no markdown, no explanation:
[{"index":1,"text":"the corrected spoken text","status":"fixed"},...]

Return an empty array [] if every block is already fine. Never echo blocks that needed no change — the app keeps unlisted blocks exactly as they are.

BLOCKS:
${pass2Blocks.map((b, i) => `[${i}] ${b.characterName}: ${JSON.stringify(b.bareText)}`).join("\n")}`;
  changes += await runReviewPass(genAI, pass2Prompt, pass2Blocks, resultBlocks, "pass2-grammar");

  // ── Pass 3: Hebrew-only nikkud/grammar + proofread cycle ────────────────
  // Passes 1-2 are language-agnostic and, even together, don't reliably
  // catch Hebrew-specific issues like a missing root letter inside a
  // vocalized word (nikkud adds enough visual noise that a generic
  // proofread pass can miss it). Runs only for Hebrew scripts, using its
  // own dedicated guidance file with an explicit nikkud-then-strip-nikkud
  // two-step read, and re-proofreads pass 1+2's own output.
  const detectedLanguage = await languagePromise;
  if (detectedLanguage === "he") {
    const pass3Blocks: IndexedTextBlock[] = resultBlocks
      .map((b, i) => ({ _idx: i, characterName: b.characterName, ...stripTag(b.textPayload) }))
      .filter((b) => b.characterName !== "SFX");
    const hebrewPassPrompt = `${readHebrewPassGuidance()}

Also include the block's index (from the BLOCKS list below) as a line "- Index: N" immediately after the [Character Name] [Original text] header line, using the same zero-based index shown below — this lets the app apply your fix to the correct block. If a block has no issues, do not mention it at all in your response.

BLOCKS:
${pass3Blocks.map((b, i) => `[${i}] ${b.characterName}: ${b.bareText}`).join("\n")}`;
    changes += await runHebrewPass(genAI, hebrewPassPrompt, pass3Blocks, resultBlocks);

    for (let i = 0; i < resultBlocks.length; i++) {
      const before = resultBlocks[i].textPayload;
      const after = applyDeterministicHebrewFixes(before);
      if (after !== before) {
        resultBlocks[i] = { ...resultBlocks[i], textPayload: after };
        console.log(`[validate-blocks][pass3-deterministic] Fixed bare Kamats כָּל -> כּוֹל in "${resultBlocks[i].characterName}"`);
        changes++;
      }
    }
  }

  if (changes > 0) console.log(`[validate-blocks] ${changes} total fix(es) across ${detectedLanguage === "he" ? "all three passes" : "both passes"}, ${textBlocks.length} block(s) reviewed.`);

  return NextResponse.json({ blocks: resultBlocks, changes });
}
