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

const SYSTEM_INSTRUCTION = `You are a children's audio drama producer creating a warm, imaginative bedtime story experience.
Your job is to take a written children's story script and produce a precise audio drama timeline
with character timing, gentle sound effects, and ambient audio cues suitable for young listeners.`;

const FORMAT_RULES = `
TIMING RULES:
- Estimate 380ms per word of dialogue (performance tags like [excited] count as 0 words)
- Add 700ms pause between different characters, 400ms between consecutive lines of the same character
- Narrator lines are ~10% slower (420ms per word)
- Start first dialogue at 1500ms to let the opening ambient SFX establish

SFX RULES:
- First track MUST be an ambient background loop (start_ms: 0, loop: true, duration_hint_ms: 12000). Its description must be a rich, gentle soundscape that matches the story's setting — include the environment, texture, and mood (e.g. "a sunny garden with soft birdsong, a gentle breeze rustling leaves, and cheerful crickets — warm, peaceful and inviting").
- Add 2–4 event SFX at emotionally significant moments (a discovery, a magical moment, a surprise, a joyful reunion).
- Each SFX description should be warm and child-friendly — 1–2 sentences describing the sound and its cheerful or gentle emotional tone. Example: "Soft wind chimes tinkling in a gentle breeze, magical and light, like fairy bells announcing something wonderful."
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
    `Create a warm, child-friendly audio drama timeline for this bedtime story.\n\n` +
    `STORY SCRIPT (may be in any language — preserve the original language in all dialogue lines):\n${scriptText}\n\n` +
    FORMAT_RULES;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
