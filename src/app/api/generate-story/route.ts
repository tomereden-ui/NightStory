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
}

interface RawBlock {
  characterName: string;
  textPayload: string;
}

// ─── Hardcoded script execution guidance ──────────────────────────────────────

const SCRIPT_GUIDANCE = `Act as an expert children's audio playwright and immersive sound designer.

Write a captivating, high-energy, and emotionally resonant children's audio drama script designed for children aged 5 to 9. The final audio run-time must be approximately 5 minutes (aim for a word count between 650 to 750 words).

### Structural Architecture
- Characters: Exactly 2 distinct, highly expressive child or animal characters, plus 1 engaging, warm, and comforting Narrator.
- Format: Standard multi-character screenplay naming formatting.
- Voice Performance Tags: Every single line of dialogue or narration MUST include bracketed emotional, tone, or breath tags (e.g., [excited], [gasp], [whispering], [laughs]) to guide the text-to-speech engine's performance.

### Language & Dialogue Pacing Rules
- Use highly active, sensory, and dynamic language (e.g., "SQUISH!", "CRACKLE!").
- Keep sentences short and punchy. Children absorb spoken audio best in brief, rhythmically varied phrases.
- Avoid abstract text. Replace descriptive prose with audible actions. Instead of saying a character is scared, write a short gasp followed by a quick, breathless line.
- Introduce natural dialogue elements: short interruptions, quick conversational back-and-forths, and matching reactive sounds.

### The Plot Outline
Ensure the story has a clear, satisfying arc: an exciting opening hook, a moment of wondrous discovery, a gentle micro-conflict or suspenseful climax, and a comforting, calming resolution perfect for a satisfying conclusion.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(body: GenerateStoryRequest): string {
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
    "\n\nIMPORTANT: Write the entire story — all narration, dialogue, and character names — in the SAME LANGUAGE as the story description or character names above. Do not switch to English if the input is in another language.\n\n" +
    "Return the story as a JSON array of script blocks. Each block must have exactly two fields:\n" +
    '- "characterName": use "Narrator" (translated to the story language) for narration, or the character\'s actual name for spoken dialogue\n' +
    '- "textPayload": the full spoken text including all performance tags (e.g., "[excited] Wow! Look at that!")\n\n' +
    "Aim for 12–18 blocks total to cover the full 5-minute runtime. Balance dialogue across all characters.\n" +
    "Return ONLY the raw JSON array — no markdown fences, no explanation, nothing else.";

  return storyDef + format;
}

function assignVoice(characterName: string, primaryVoiceId: string, heroName: string): string {
  const name = characterName.toLowerCase();
  if (name === "narrator") return "v1";
  // if the block character matches the hero name, use the user's chosen voice
  if (heroName && name.includes(heroName.toLowerCase().slice(0, 5))) return primaryVoiceId;
  // secondary characters alternate between v3 and v4
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

  const prompt = buildPrompt(body);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SCRIPT_GUIDANCE,
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip optional markdown fences Gemini sometimes adds despite instructions
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
