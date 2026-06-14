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
- First track MUST be an ambient background loop (start_ms: 0, loop: true, duration_hint_ms: 12000). Its description must be a rich, evocative soundscape that matches the story's setting exactly — include the environment, texture, mood, and subtle details (e.g. "a dense enchanted forest at night, with soft cricket chirps, distant owl hoots, leaves rustling in a light breeze, and a faint magical shimmer — peaceful and mysterious").
- Add 2–4 event SFX at emotionally significant moments (a discovery, a scare, a magical moment, a surprise).
- Each SFX description must be detailed and cinematic — 2–3 sentences describing the exact sound, its texture, intensity, and emotional tone so the sound generator can produce it precisely. Example: "A single wooden door creaking open slowly, old and heavy, with a deep groan that echoes in a stone corridor. Tense and eerie."
- Non-looping SFX duration_hint_ms: typically 1500–4000ms

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
  const scriptText = blocks
    .map((b) => `${b.characterName}: ${b.textPayload}`)
    .join("\n");

  const prompt =
    `${SYSTEM_INSTRUCTION}\n\n` +
    `Convert this children's story script into a complete audio drama timeline.\n\n` +
    `STORY SCRIPT:\n${scriptText}\n\n` +
    FORMAT_RULES;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drama planner API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();

  // Surface API-level errors (e.g. quota exceeded, invalid key)
  if (data.error) {
    throw new Error(`Drama planner API error: ${data.error.message ?? JSON.stringify(data.error)}`);
  }

  const raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  if (!raw) {
    const finishReason = data?.candidates?.[0]?.finishReason ?? "unknown";
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(
      `Drama planner returned empty response. finishReason=${finishReason}${blocked ? `, blockReason=${blocked}` : ""}`
    );
  }

  let parsed: DramaScript;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Drama planner returned invalid JSON: ${raw.slice(0, 300)}`);
  }

  parsed.tracks = parsed.tracks
    .sort((a, b) => a.start_ms - b.start_ms)
    .map((t, i) => ({ ...t, id: `t${i + 1}` }));

  return parsed;
}
