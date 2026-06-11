import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScriptBlock } from "@/types";

export interface DramaTrack {
  id: string;
  type: "dialogue" | "sfx";
  start_ms: number;
  // dialogue
  character?: string;
  voice_style?: string;
  line?: string;
  // sfx
  description?: string;
  duration_hint_ms?: number;
  loop?: boolean;
}

export interface DramaScript {
  title: string;
  duration_estimate_seconds: number;
  tracks: DramaTrack[];
}

const SYSTEM_INSTRUCTION = `You are an expert audio drama director and sound designer.
Your job is to take a written story script and produce a precise audio drama timeline
with character timing, sound effects, and ambient audio cues.`;

const FORMAT_RULES = `
TIMING RULES:
- Estimate 380ms per word of dialogue (performance tags like [excited] count as 0 words)
- Add 700ms pause between different characters, 400ms between consecutive lines of the same character
- Narrator lines are ~10% slower (420ms per word)
- Start first dialogue at 1500ms to let the opening ambient SFX establish

SFX RULES:
- First track MUST be an ambient background loop (start_ms: 0, loop: true, duration_hint_ms: 12000). Its description must match the story's setting — e.g. "gentle forest ambience with birds and rustling leaves" for a forest, "ocean waves on a sandy beach" for the sea, "cozy fireplace crackling indoors" for a home. Choose the most fitting soundscape for the story.
- Add 2–4 event SFX at emotionally significant moments (a discovery, a scare, a magical moment)
- SFX descriptions must be short, concrete, and specific (e.g. "owl hooting in a dark forest, single call")
- Non-looping SFX duration_hint_ms: typically 1000–4000ms

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "title": "Story Title",
  "duration_estimate_seconds": 180,
  "tracks": [
    {
      "id": "t1",
      "type": "sfx",
      "start_ms": 0,
      "description": "magical starry night ambience, soft and dreamy",
      "duration_hint_ms": 12000,
      "loop": true
    },
    {
      "id": "t2",
      "type": "dialogue",
      "start_ms": 1500,
      "character": "Narrator",
      "voice_style": "warm, gentle, storyteller",
      "line": "[softly] Once upon a time..."
    }
  ]
}`;

export async function planDrama(
  blocks: ScriptBlock[],
  apiKey: string,
): Promise<DramaScript> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const scriptText = blocks
    .map((b) => `${b.characterName}: ${b.textPayload}`)
    .join("\n");

  const prompt =
    `Convert this children's story script into a complete audio drama timeline.\n\n` +
    `STORY SCRIPT:\n${scriptText}\n\n` +
    FORMAT_RULES;

  const result = await model.generateContent(prompt);
  const raw = result.response
    .text()
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: DramaScript;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Drama planner returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Sort by start_ms and ensure IDs are unique
  parsed.tracks = parsed.tracks
    .sort((a, b) => a.start_ms - b.start_ms)
    .map((t, i) => ({ ...t, id: `t${i + 1}` }));

  return parsed;
}
