import type { ScriptBlock } from "@/types";

export async function generateCoverImage(
  title: string,
  blocks: ScriptBlock[],
  apiKey: string,
): Promise<Buffer | null> {
  const characters = Array.from(
    new Set(
      blocks
        .filter((b) => b.characterName !== "SFX" && !b.characterName.toLowerCase().includes("narrat"))
        .map((b) => b.characterName),
    ),
  ).slice(0, 4);

  const narratorBlocks = blocks.filter((b) => b.characterName.toLowerCase().includes("narrat"));
  const pickIndices = [0, Math.floor(narratorBlocks.length / 2), narratorBlocks.length - 1];
  const narratorExcerpt = pickIndices
    .map((i) => narratorBlocks[i]?.textPayload ?? "")
    .filter(Boolean)
    .map((t) => t.replace(/\[.*?\]/g, "").trim())
    .join(" ")
    .slice(0, 500);

  const storyContext = `Title: "${title}"\nCharacters: ${characters.join(", ") || "main characters"}\nStory excerpt: "${narratorExcerpt}"`;

  // ── Step 1: Gemini text → character-first scene description ──────────────
  let scenePrompt = `${characters[0] ?? "the hero"} and friends in a magical moment from the story "${title}"`;
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
              text: `You are a children's book illustrator writing an image prompt. Describe ONLY what a camera would see in the foreground of this book cover — the characters, their expressions, what they are doing, and where they are standing.

RULES:
- START with the main character(s): their species/appearance, clothing or fur color, size, emotion
- Then describe the action they are doing right now
- Then the setting behind them with 2 specific visual details
- End with one lighting detail
- DO NOT mention sky or moon as the main subject
- 3 sentences maximum

${storyContext}

Write ONLY the image prompt. No labels, no quotes.`,
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
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

  // ── Step 2: generate image ────────────────────────────────────────────────
  const fullPrompt = `${scenePrompt}

Illustrated in a soft watercolor style for a children's bedtime book cover. The characters described above are the main subject, large and centered in the lower two-thirds of the image, warmly lit by a gentle amber glow. Behind them, a soft dark indigo night sky with scattered stars forms the background only. Square composition, painterly brush strokes, cozy and dreamy mood. No text, no letters, no numbers anywhere in the image.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );
    const data = await res.json();
    const parts: { inlineData?: { mimeType: string; data: string } }[] =
      data?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
    console.warn("[CoverImage] No image part in response");
    return null;
  } catch (err) {
    console.warn("[CoverImage] Generation failed:", err);
    return null;
  }
}
