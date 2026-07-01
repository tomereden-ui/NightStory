import type { ScriptBlock } from "@/types";
import { generateWithImagen } from "./imagenClient";
import { buildCoverScenePrompt, buildFinalCoverPrompt } from "@/config/coverImageInstructions";

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
              parts: [{ text: buildCoverScenePrompt(storyContext) }],
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
  const fullPrompt = buildFinalCoverPrompt(scenePrompt);

  const result = await generateWithImagen(fullPrompt, apiKey);
  if (result) console.log("[CoverImage] Generated with Imagen");
  return result;
}
