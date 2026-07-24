// Canonical mood taxonomy for AI scene classification/generation. Gemini
// tags each scene with one of these (see `primaryMood` on StoryScene) both
// when a story is first written (generate-story/route.ts,
// five-question-story/route.ts) and when produce-drama's post-hoc scene
// breakdown classifies an already-finished script (sceneGenerator.ts, which
// pulls its own copy of this list + definitions from config/story-guidance.txt
// — keep that file's SCENE BREAKDOWN section in sync with the list below).
import type { IconName } from "@/lib/icons";

export interface MoodDefinition {
  id: string;
  /** Abstract line icon (see src/lib/icons.ts) — deliberately not an emoji, matching the rest of the app's icon style. */
  icon: IconName;
  color: string;
  /** Sent to Gemini so it can classify/generate against a concrete definition, not just a bare word. */
  definition: string;
}

export const MOODS: MoodDefinition[] = [
  { id: "Cozy", icon: "flame", color: "#f59e0b", definition: "A warm, soothing, and comforting atmosphere. Focuses on feelings of safety, home, and gentle wind-down for bedtime or quiet moments." },
  { id: "Whimsical", icon: "sparkles", color: "#a78bfa", definition: "Enchanting, magical, and imaginative. Filled with wonder, fairytale logic, and delightful surprises that spark curiosity." },
  { id: "Adventurous", icon: "compass", color: "#4fc3f7", definition: "Dynamic, brave, and full of action. Drives the narrative forward with exciting journeys, challenges, and child-driven problem solving." },
  { id: "Mysterious", icon: "search", color: "#8b5cf6", definition: "Intriguing, thoughtful, and riddle-filled. Focuses on gathering clues, solving gentle secrets, and engaging critical thinking without fear." },
  { id: "Playful", icon: "balloon", color: "#fbbf24", definition: "Lighthearted, energetic, and engaging. Captures everyday fun, social connections, and interactive, joyful moments." },
  { id: "Silly", icon: "laugh", color: "#fb923c", definition: "Humorous, absurd, and funny. Uses age-appropriate nonsense, unexpected twists, and laughter to release stress." },
];

// Gemini-facing block for the "primaryMood" scene field — full definitions,
// not just names, so classification/generation is grounded in what each
// mood actually means rather than guessed from the word alone.
export function buildMoodPromptSpec(): string {
  return MOODS.map((m) => `  - ${m.id}: ${m.definition}`).join("\n");
}
