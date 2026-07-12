import { geminiPost, geminiText } from "@/lib/geminiClient";
import type { AgeBucket, CharacterCategory } from "@/types";

export interface CharacterClassification {
  type: string;
  visualDescription: string;
  /** "male" | "female" | "neutral" — was previously never populated despite
   *  CharacterProfile having a gender field; both voice casting and avatar
   *  matching need this to actually be a hard signal, not inferred later. */
  gender?: string;
  /** Age granularity beyond type's coarse child/adult/animal split — lets
   *  avatar matching tell a "young prince" from an "elderly grandfather"
   *  instead of both just being generic "adult". */
  ageBucket?: AgeBucket;
  /** Splits type's catch-all "animal" (= any non-human) into real kinds so
   *  avatar matching maps animals to animals, plants to plants, objects to
   *  objects — a tree character must never draw from the pig pool. */
  category?: CharacterCategory;
}

/**
 * Classifies each character's type ("child" | "adult" | "animal"), gender,
 * age bucket, and visual appearance from a script sample, for avatar
 * generation/matching and nature-based voice casting. Shared by the live
 * studio flow (classify-characters route) and the admin
 * backfill-character-profiles / reassign-voices / reassign-avatars retrofits.
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
    result["Narrator"] = { type: "narrator", visualDescription: "warm wise storyteller", gender: "neutral" };
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
  "gender": exactly one of "male" | "female" | "neutral" (use "neutral" only when truly ambiguous or non-gendered, e.g. an unseen narrator or a genderless creature — most characters DO have a discernible gender from the script, don't default to neutral out of caution)
  "ageBucket": exactly one of "toddler" | "child" | "teen" | "young_adult" | "middle_aged" | "elderly" — best estimate even for animals (a baby animal is "toddler" or "child", a wise old owl is "elderly")
  "category": exactly one of "human" | "animal" | "plant" | "object" | "fantasy"
    - "human"   = any person (matches type child/adult)
    - "animal"  = real-world animals (dog, owl, bear, fish…)
    - "plant"   = trees, flowers, mushrooms
    - "object"  = inanimate things brought to life (balloon, robot, toy, vehicle)
    - "fantasy" = mythical beings (dragon, unicorn, fairy, monster)
  "visualDescription": 10–15 words in English describing their actual appearance.
    RULES: Always English. Derive from script content, not name alone.
    Well-known characters (Dumbo, Simba, Nemo…) must use their canonical appearance.
    Animals: species + size + colour + one distinctive feature.
    Humans: age + hair + one feature + expression.
    AGING/TRANSFORMING characters: if a character ages or changes form across the
    story (e.g. "the boy" in The Giving Tree who grows old), profile them as they
    are when INTRODUCED / in their iconic form — their portrait represents who
    they are to the listener, not where the story leaves them. A character
    named "the boy" is a child, even if he is elderly by the last page.

Example output:
{
  "Luna":    { "type": "child",  "gender": "female", "ageBucket": "child",   "category": "human",  "visualDescription": "curious 7-year-old girl with curly red hair and bright eyes" },
  "Dumbo":   { "type": "animal", "gender": "male",   "ageBucket": "toddler", "category": "animal", "visualDescription": "large gray baby elephant with enormous floppy ears" },
  "The Oak": { "type": "animal", "gender": "neutral","ageBucket": "elderly", "category": "plant",  "visualDescription": "ancient wide oak tree with deep green leaves and kind presence" },
  "Grandpa": { "type": "adult",  "gender": "male",   "ageBucket": "elderly", "category": "human",  "visualDescription": "kind elderly man with white beard and warm smile" }
}`,
        }],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
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
