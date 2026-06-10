import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GenerateStoryRequest {
  mode: "wizard" | "prompt";
  // wizard fields
  hero?: string;
  setting?: string;
  plot?: string;
  // prompt tab
  promptText?: string;
  // primary voice id chosen by user (v1–v4)
  primaryVoiceId: string;
  // desired audio length in minutes (1–15)
  durationMinutes?: number;
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

// ─── Dynamic script guidance based on requested duration ──────────────────────

function buildScriptGuidance(durationMinutes: number): string {
  const targetWords = Math.round(durationMinutes * 140);
  const wordRange = `${targetWords - 60}–${targetWords + 60}`;
  const minBlocks = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks = Math.max(8, Math.round(durationMinutes * 3.6));

  return `Act as an expert children's audio playwright and immersive sound designer.

Write a captivating, high-energy, and emotionally resonant children's audio drama script designed for children aged 5 to 9.
The final audio run-time must be exactly ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""} (aim for a word count of ${wordRange} words).

### Structural Architecture
- Characters: Exactly 2 distinct, highly expressive child or animal characters, plus 1 engaging, warm, and comforting Narrator.
- Format: Standard multi-character screenplay naming formatting.
- Voice Performance Tags: Every single line of dialogue or narration MUST include bracketed emotional, tone, or breath tags (e.g., [excited], [gasp], [whispering], [laughs]) to guide the text-to-speech engine's performance.
- Script blocks: Aim for ${minBlocks}–${maxBlocks} blocks to fill the full ${durationMinutes}-minute runtime.

### Language & Dialogue Pacing Rules
- Use highly active, sensory, and dynamic language (e.g., "SQUISH!", "CRACKLE!").
- Keep sentences short and punchy. Children absorb spoken audio best in brief, rhythmically varied phrases.
- Avoid abstract text. Replace descriptive prose with audible actions. Instead of saying a character is scared, write a short gasp followed by a quick, breathless line.
- Introduce natural dialogue elements: short interruptions, quick conversational back-and-forths, and matching reactive sounds.

### The Plot Outline
Ensure the story has a clear, satisfying arc: an exciting opening hook, a moment of wondrous discovery, a gentle micro-conflict or suspenseful climax, and a comforting, calming resolution.
${durationMinutes >= 8 ? "For longer stories, develop the world and characters more deeply — add a secondary subplot, extra sensory detail, and more extended emotional beats." : ""}

### Language
Determine the story language from the PROSE TEXT of the description — sentences, plot descriptions, setting descriptions. Character names and place names are proper nouns and must NOT be used to infer the language. For example, a character named "Amit", "Liu", or "Lior" does not make the story Hindi, Chinese, or Hebrew. If the prose is written in English, write the entire script in English. Only use a non-English language if the prose itself is written in that language.`;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(body: GenerateStoryRequest): string {
  const durationMinutes = Math.min(15, Math.max(1, body.durationMinutes ?? 5));
  const targetWords = Math.round(durationMinutes * 140);
  const minBlocks = Math.max(4, Math.round(durationMinutes * 2.5));
  const maxBlocks = Math.max(8, Math.round(durationMinutes * 3.6));

  let storyDef = "";
  if (body.mode === "prompt" && body.promptText) {
    storyDef = `\n\nStory description:\n${body.promptText}`;
  } else {
    const parts: string[] = [];
    if (body.hero)    parts.push(`Main character: ${body.hero}`);
    if (body.setting) parts.push(`Setting: ${body.setting}`);
    if (body.plot)    parts.push(`Plot: ${body.plot}`);
    if (parts.length) storyDef = "\n\n" + parts.join("\n");
  }

  const format =
    `\n\nLANGUAGE RULE: Look at the PROSE SENTENCES in the story description above (not the character names) to determine the language. If the sentences are in English, write the entire script in English — even if a character is named "Amit" or has a non-English name. If the sentences are in Hebrew, write in Hebrew. Character and place names are not language indicators. Never mix languages.\n\n` +
    `Target runtime: ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""} (≈ ${targetWords} words spoken aloud).\n\n` +
    `Return the story as a JSON array of script blocks. Each block must have exactly two fields:\n` +
    `- "characterName": use "Narrator" (translated to the story language) for narration, or the character's actual name for spoken dialogue\n` +
    `- "textPayload": the full spoken text including all performance tags (e.g., "[excited] Wow! Look at that!")\n\n` +
    `Aim for ${minBlocks}–${maxBlocks} blocks to fill the full runtime. Balance dialogue across all characters.\n` +
    `Return ONLY the raw JSON array — no markdown fences, no explanation, nothing else.`;

  return storyDef + format;
}

function assignVoice(characterName: string, primaryVoiceId: string, heroName: string): string {
  const name = characterName.toLowerCase();
  if (name === "narrator") return "v1";
  if (heroName && name.includes(heroName.toLowerCase().slice(0, 5))) return primaryVoiceId;
  return "v3";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: GenerateStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const durationMinutes = Math.min(15, Math.max(1, body.durationMinutes ?? 5));
  const prompt = buildPrompt(body);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildScriptGuidance(durationMinutes),
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let raw: RawBlock[];
    try {
      raw = JSON.parse(json);
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON output.", raw: text }, { status: 502 });
    }

    const heroName = body.hero ?? "";
    const blocks = raw.map((block, i) => ({
      id: `blk-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      blockOrder: i + 1,
      characterName: block.characterName,
      assignedVoiceId: assignVoice(block.characterName, body.primaryVoiceId, heroName),
      textPayload: block.textPayload,
    }));

    return NextResponse.json({ blocks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
