import type { ScriptBlock } from "@/types";
import { generateWithImagen } from "./imagenClient";

export async function generateCoverImage(
  title: string,
  blocks: ScriptBlock[],
  apiKey: string,
  coverPrompt?: string,
): Promise<{ buf: Buffer; mimeType: string } | null> {
  // ── Step 1: build scene description ──────────────────────────────────────────
  const characters = Array.from(
    new Set(
      blocks
        .filter((b) => b.characterName !== "SFX" && !b.characterName.toLowerCase().includes("narrat"))
        .map((b) => b.characterName),
    ),
  ).slice(0, 4);

  let scenePrompt: string;

  if (coverPrompt?.trim()) {
    scenePrompt = coverPrompt.trim();
    console.log("[CoverImage] Using story coverPrompt:", scenePrompt.slice(0, 120));
  } else {
    const narratorBlocks = blocks.filter((b) => b.characterName.toLowerCase().includes("narrat"));
    const allSpeechBlocks = blocks.filter((b) => b.characterName !== "SFX");
    const pickIndices = [0, Math.floor(narratorBlocks.length / 2), narratorBlocks.length - 1];
    const narratorExcerpt = pickIndices
      .map((i) => narratorBlocks[i]?.textPayload ?? "")
      .filter(Boolean)
      .map((t) => t.replace(/\[.*?\]/g, "").trim())
      .join(" ")
      .slice(0, 300);

    const scriptSample = allSpeechBlocks
      .slice(0, 20)
      .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
      .join("\n")
      .slice(0, 800);

    const storyContext = `Title: "${title}"\nCharacters: ${characters.join(", ") || "main characters"}\nStory excerpt: "${narratorExcerpt}"\n\nScript sample:\n${scriptSample}`;

    scenePrompt = `${characters[0] ?? "the hero"} and friends in a magical moment from the story "${title}"`;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text: `You are a children's book illustrator writing an image generation prompt for a book cover.

Your job: describe the SINGLE most important visual subject of this story so that an AI image generator renders it correctly.

RULES — follow in order:
1. FIRST WORD must be the main character's species or type (e.g. "Elephant", "Young girl", "Dragon", "Fox"). Never start with a setting word.
2. Then describe appearance in detail: size, color, texture, clothing or fur, expression, one unique feature.
3. Then describe what the character is DOING right now in this scene (one action).
4. Then describe the setting with exactly 2 vivid visual details behind the character.
5. End with one lighting detail.

IMPORTANT:
- If the main character is an animal, lead with that animal — never bury it in the description.
- DO NOT use character names. Describe by appearance only.
- 2–3 sentences total. No extra commentary.

${storyContext}

Write ONLY the image prompt text. No labels, no quotes, no intro.`,
              }],
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const enhanced = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (enhanced && enhanced.length > 20) scenePrompt = enhanced;
      }
    } catch (err) {
      console.warn("[CoverImage] Scene prompt enhancement failed:", err);
    }
  }

  // ── Step 2: generate image with Imagen ───────────────────────────────────────
  const fullPrompt = `${scenePrompt}

The subject described above is the MAIN FOCUS — large, centered, and unmistakable. Illustrated as a glowing 3D rendered children's book cover in Pixar style. Deep cosmic night scene with rich navy-blue and teal tones. Soft volumetric lighting and gentle bioluminescent rim glow on the main subject. Scattered stars and a faint nebula in the background. Square composition, dreamy magical atmosphere, smooth gradients. No text, no letters, no numbers anywhere.`;

  const result = await generateWithImagen(fullPrompt, apiKey);
  if (result) console.log("[CoverImage] Generated with Imagen");
  return result;
}
