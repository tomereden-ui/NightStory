import type { ScriptBlock } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export interface DramaTrack {
  id: string;
  type: "dialogue" | "sfx";
  start_ms: number;
  end_ms?: number;   // set after mixing; reflects actual audio position
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

// How much longer the final mix may run past the last real line of dialogue,
// as a closing ambient wind-down. This is the only padding allowed — it stops
// produce-drama from stretching the ambient loop indefinitely to fake a match
// against the requested duration when the underlying script came out short.
export const MAX_TRAILING_SFX_SECONDS = 20;

const SYSTEM_INSTRUCTION = `You are a children's audio drama producer creating a warm, imaginative bedtime story experience.
Your job is to take a written children's story script and produce a precise audio drama timeline
with character timing, gentle sound effects, and ambient audio cues suitable for young listeners.`;

const FORMAT_RULES = `
TIMING RULES — make it sound like a live natural performance, NOT a robotic sequence:
- Estimate spoken word duration: 380ms/word standard; 450ms/word for narrators/elderly/reflective characters; 320ms/word for children/excited characters
- Performance tags like [excited] or [whispers] count as 0 words but affect delivery, not timing
- Gaps between DIFFERENT speakers (choose based on dramatic context):
  • Rapid back-and-forth or argument: 100–200ms
  • Normal conversational reply: 250–400ms
  • Thoughtful, emotional, or surprised response: 500–700ms
  • After narrator sets a scene before first character speaks: 400–600ms
  • After a dramatic revelation or emotional peak: 700–1000ms
- Gaps for SAME character continuing:
  • Natural breath between sentences: 150–250ms
  • Deliberate pause for dramatic effect: 350–500ms
- NEVER add mechanical silence where the story flows naturally — every gap must serve the narrative
- Start first dialogue at 1500ms to let the opening ambient SFX establish

SFX RULES:
- ALL SFX descriptions MUST be written in English only, regardless of the story's language. Never use Hebrew, Spanish, French, or any other language for SFX descriptions — ElevenLabs sound generation only works correctly with English.
- SFX descriptions must be compact comma-separated sound descriptors, NOT sentences or prose. Write what the sound IS, not a story about it. Good: "soft wind chimes, gentle, magical, tinkling". Bad: "Soft wind chimes tinkling in a gentle breeze, magical and light, like fairy bells announcing something wonderful." The bad format causes the model to read the text aloud instead of generating audio.
- Keep descriptions under 15 words. Focus on: environment/source + texture + mood. Example: "crackling fireplace, warm and cozy, gentle pops"
- First track MUST be an ambient background loop (start_ms: 0, loop: true, duration_hint_ms: 12000). Describe the setting's soundscape in comma-separated form: e.g. "sunny garden, soft birdsong, gentle breeze, rustling leaves, peaceful"
- Add 2–4 event SFX at emotionally significant moments (a discovery, a magical moment, a surprise, a joyful reunion).
- Non-looping SFX duration_hint_ms: typically 1500–4000ms
- If the script's real dialogue runs shorter than the target duration, do NOT pad the gap with a longer ambient loop or extra silence — that is not your job. A closing ambient wind-down after the last line may run at most ${MAX_TRAILING_SFX_SECONDS} seconds; anything beyond that must come from the dialogue itself being the right length, which is decided before this step.

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "title": "Story Title",
  "duration_estimate_seconds": 180,
  "tracks": [
    {
      "id": "t1",
      "type": "sfx",
      "start_ms": 0,
      "description": "magical starry night, soft crickets, gentle wind, dreamy and calm",
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
  durationMinutes = 3,
  existingTitle?: string,
): Promise<DramaScript> {
  const scriptText = blocks
    .map((b) => `${b.characterName}: ${b.textPayload}`)
    .join("\n");

  const prompt =
    `${SYSTEM_INSTRUCTION}\n\n` +
    `Create a warm, child-friendly audio drama timeline for this bedtime story.\n` +
    `TARGET DURATION: approximately ${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""} (${durationMinutes * 60} seconds). ` +
    `This script was already written to roughly match that length, so pace the dialogue naturally rather than stretching or ` +
    `compressing it to force a match. Set duration_estimate_seconds to your own honest estimate of this timeline's real total ` +
    `length in seconds (sum of dialogue timing, gaps, and SFX) — never just copy the target number.\n\n` +
    `STORY SCRIPT (may be in any language — copy each dialogue line's "line" text EXACTLY as written below, character-for-character, including any Hebrew niqqud/vowel points — do not transliterate, translate, or strip diacritics):\n${scriptText}\n\n` +
    FORMAT_RULES;

  const { data, ok, status } = await geminiPost(apiKey, "gemini-3.5-flash", {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    // Unlike generate-story's 8192 (which only needs to hold the raw dialogue
    // text once), this output repeats every line's text again inside a much
    // heavier per-track JSON structure (id/timing/voice_style/etc. for every
    // line, plus SFX tracks) — 8192 was just the bare API default, not a
    // deliberate budget, and was silently truncating mid-JSON on longer
    // stories (a cut-off response looks identical to genuinely malformed
    // JSON — see the finishReason check below). The model supports up to
    // ~65K; 32768 gives generous headroom without reaching for the max.
    generationConfig: { temperature: 0.4, maxOutputTokens: 32768, thinkingConfig: { thinkingBudget: 0 } },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  });

  if (!ok) {
    throw new Error(`Drama planner API error ${status}`);
  }

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
    // A response cut off mid-JSON (hit maxOutputTokens) looks identical to
    // genuinely malformed JSON from the parse error alone — finishReason
    // tells them apart. Log the full response server-side (the thrown
    // message stays short — it surfaces in the job's user-facing error).
    const finishReason = data?.candidates?.[0]?.finishReason ?? "unknown";
    console.error(`[dramaPlanner] Invalid JSON — finishReason=${finishReason}, length=${raw.length} chars. Full response:\n${raw}`);
    throw new Error(`Drama planner returned invalid JSON (finishReason=${finishReason}): ${raw.slice(0, 300)}`);
  }

  parsed.tracks = parsed.tracks
    .sort((a, b) => a.start_ms - b.start_ms)
    .map((t, i) => ({ ...t, id: `t${i + 1}` }));

  // Respect a caller-supplied title (e.g. one an admin typed in by hand)
  // instead of the one Gemini invented above — cheaper than reworking the
  // prompt to skip title generation, and callers that don't have a title
  // of their own simply don't pass this, so behavior there is unchanged.
  if (existingTitle?.trim()) parsed.title = existingTitle.trim();

  return parsed;
}
