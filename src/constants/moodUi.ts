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

// Gemini-facing instruction block for user-picked story mood(s) — the
// 5-Question wizard's optional "moods" step (Answers.storyMoods). English
// ids stay canonical (they must match a MOODS[].id exactly); only shown to
// the model, never localized.
export function buildChosenMoodPromptBlock(chosenIds: string[]): string {
  if (!chosenIds.length) return "";
  const lines = chosenIds
    .map((id) => MOODS.find((m) => m.id === id))
    .filter((m): m is MoodDefinition => !!m)
    .map((m, i) => `${i + 1}. ${m.id}: ${m.definition}`);
  if (!lines.length) return "";
  return `\n\nSTORY MOOD\n----------\nWrite this story so its overall atmosphere embodies the following mood(s):\n${lines.join("\n")}\nMost scenes' "primaryMood" should be drawn from this list — deviate only where a specific beat genuinely calls for a different one of the six moods (e.g. the scene-arc rule above).`;
}

// Localized display labels for the mood picker UI (5-Question wizard's
// "moods" step + anywhere else a user picks a mood by hand) — the ids
// themselves and their Gemini-facing definitions above stay English-only.
const STORY_MOOD_LABELS_BY_LANG: Record<string, Record<string, string>> = {
  en: { Cozy: "Cozy", Whimsical: "Whimsical", Adventurous: "Adventurous", Mysterious: "Mysterious", Playful: "Playful", Silly: "Silly" },
  he: { Cozy: "חמים", Whimsical: "קסום", Adventurous: "הרפתקני", Mysterious: "מסתורי", Playful: "משעשע", Silly: "מצחיק" },
  es: { Cozy: "Acogedor", Whimsical: "Fantasioso", Adventurous: "Aventurero", Mysterious: "Misterioso", Playful: "Juguetón", Silly: "Disparatado" },
  fr: { Cozy: "Douillet", Whimsical: "Fantaisiste", Adventurous: "Aventureux", Mysterious: "Mystérieux", Playful: "Enjoué", Silly: "Loufoque" },
  de: { Cozy: "Gemütlich", Whimsical: "Fantasievoll", Adventurous: "Abenteuerlich", Mysterious: "Geheimnisvoll", Playful: "Verspielt", Silly: "Albern" },
  pt: { Cozy: "Aconchegante", Whimsical: "Fantasioso", Adventurous: "Aventureiro", Mysterious: "Misterioso", Playful: "Brincalhão", Silly: "Bobo" },
  it: { Cozy: "Accogliente", Whimsical: "Fantasioso", Adventurous: "Avventuroso", Mysterious: "Misterioso", Playful: "Giocoso", Silly: "Sciocco" },
  ar: { Cozy: "دافئ", Whimsical: "خيالي", Adventurous: "مغامر", Mysterious: "غامض", Playful: "مرح", Silly: "مضحك" },
  ja: { Cozy: "心地よい", Whimsical: "幻想的", Adventurous: "冒険的", Mysterious: "神秘的", Playful: "遊び心のある", Silly: "おどけた" },
  hi: { Cozy: "आरामदायक", Whimsical: "कल्पनाशील", Adventurous: "साहसिक", Mysterious: "रहस्यमय", Playful: "चंचल", Silly: "नटखट" },
};

export function getStoryMoodLabels(language?: string): Record<string, string> {
  return (language && STORY_MOOD_LABELS_BY_LANG[language]) || STORY_MOOD_LABELS_BY_LANG.en;
}
