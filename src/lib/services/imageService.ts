import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScriptBlock } from "@/types";

const IMAGE_STYLE = `
Art direction: dark magical nighttime children's book illustration.
- Deep navy, indigo, and cosmic purple palette with pockets of warm amber or teal glow
- Soft painterly watercolor style — loose, luminous brush strokes
- Light sources: lanterns, fireflies, moonbeams, glowing flowers, star clusters
- Foreground characters lit warmly from below or by a magical glow source
- Rich atmospheric depth — layered background fading into a starlit sky
- Mood: cozy, wondrous, safe, dreamlike — a child can fall asleep looking at it
- Square composition, subject centered with negative space above for sky
- NO text, NO words, NO letters, NO numbers anywhere in the image`;

export async function generateCoverImage(
  title: string,
  blocks: ScriptBlock[],
  apiKey: string,
): Promise<Buffer | null> {
  // Extract named characters (excluding Narrator and SFX)
  const characters = Array.from(
    new Set(
      blocks
        .filter((b) => b.characterName !== "SFX" && !b.characterName.toLowerCase().includes("narrat"))
        .map((b) => b.characterName),
    ),
  ).slice(0, 4);

  // Pull key narrative lines from the narrator (first + middle + near end)
  const narratorBlocks = blocks.filter((b) => b.characterName.toLowerCase().includes("narrat"));
  const pickIndices = [0, Math.floor(narratorBlocks.length / 2), narratorBlocks.length - 1];
  const narratorExcerpt = pickIndices
    .map((i) => narratorBlocks[i]?.textPayload ?? "")
    .filter(Boolean)
    .map((t) => t.replace(/\[.*?\]/g, "").trim())
    .join(" ")
    .slice(0, 500);

  const storyContext = `Title: "${title}"\nCharacters: ${characters.join(", ") || "main characters"}\nStory excerpt: "${narratorExcerpt}"`;

  // ── Step 1: ask Gemini text to write a vivid, story-specific scene prompt ──
  let scenePrompt = `${characters[0] ?? "the hero"} and friends in a magical moment from the story "${title}"`;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const textResult = await textModel.generateContent(
      `You are a children's book art director. Write a vivid, specific image generation prompt (2–3 sentences) for the cover of this bedtime story.

The prompt must:
- Name the exact characters and describe what they look like (species, size, color, expression)
- Describe what they are DOING in the key emotional scene of the story
- Specify the setting in concrete visual detail (forest clearing, moonlit garden, cozy bedroom, etc.)
- Capture the story's emotional heart — wonder, friendship, courage, discovery

${storyContext}

Return ONLY the image prompt. No explanation, no quotes, no labels.`,
    );
    const enhanced = textResult.response.text().trim();
    if (enhanced) scenePrompt = enhanced;
  } catch (err) {
    console.warn("[CoverImage] Scene prompt enhancement failed:", err);
  }

  // ── Step 2: generate image with scene first, style second ──────────────────
  const fullPrompt = `${scenePrompt}\n${IMAGE_STYLE}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const imageModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-preview-image-generation",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (imageModel as any).generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part?.inlineData?.mimeType?.startsWith("image/")) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }

    console.warn("[CoverImage] No image part in Gemini response");
    return null;
  } catch (err) {
    console.warn("[CoverImage] Generation failed:", err);
    return null;
  }
}
