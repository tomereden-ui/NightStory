import { geminiPost, geminiText } from "@/lib/geminiClient";

export interface CharacterClassification {
  type: string;
  visualDescription: string;
}

/**
 * Classifies each character's type ("child" | "adult" | "animal") and visual
 * appearance from a script sample, for avatar generation and (as a fallback)
 * nature-based voice casting. Shared by the live studio flow (classify-characters
 * route) and the admin backfill-character-profiles retrofit.
 */
export async function classifyCharacters(
  characters: string[],
  summary: string | undefined,
  scriptSample: string | undefined,
  apiKey: string,
): Promise<Record<string, CharacterClassification>> {
  // Always treat "Narrator" as narrator without calling AI
  const nonNarrators = characters.filter((c) => c !== "Narrator" && c !== "SFX");
  const result: Record<string, CharacterClassification> = {};
  if (characters.includes("Narrator")) {
    result["Narrator"] = { type: "narrator", visualDescription: "warm wise storyteller" };
  }

  if (!nonNarrators.length) return result;

  const scriptContext = scriptSample
    ? `\nScript excerpt (read carefully to identify each character's actual species and appearance):\n${scriptSample}`
    : "";

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are profiling characters in a children's bedtime story for avatar generation.

Story summary: ${summary ?? "a bedtime adventure"}${scriptContext}

Characters to profile: ${nonNarrators.join(", ")}

For EACH character, read the script excerpt above carefully. Identify:
1. What species/kind of being they actually are (read what they DO and SAY, not just the name)
2. Their physical appearance — size, colour, age, distinctive feature, emotional presence

Return ONLY a valid JSON object mapping each character name to:
  "type": exactly one of "child" | "adult" | "animal"
    - "child"  = human children, baby animals, juvenile creatures of any species
    - "adult"  = grown-up humans, elders, wizards, parents
    - "animal" = any animal, creature, fairy, monster, mythical being, robot, non-human
  "visualDescription": 10–15 words in English describing their actual appearance.
    RULES: Always English. Derive from script content, not name alone.
    Well-known characters (Dumbo, Simba, Nemo…) must use their canonical appearance.
    Animals: species + size + colour + one distinctive feature.
    Humans: age + hair + one feature + expression.

Example output:
{
  "Luna":   { "type": "child",  "visualDescription": "curious 7-year-old girl with curly red hair and bright eyes" },
  "Dumbo":  { "type": "animal", "visualDescription": "large gray baby elephant with enormous floppy ears" },
  "Grandpa":{ "type": "adult",  "visualDescription": "kind elderly man with white beard and warm smile" }
}`,
        }],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = geminiText(data);
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, CharacterClassification>;
    return { ...result, ...parsed };
  } catch (err) {
    console.warn("[classifyCharacters] AI classification failed, using fallback:", err);
    for (const name of nonNarrators) {
      result[name] = { type: "adult", visualDescription: `${name}, friendly storybook character` };
    }
    return result;
  }
}
