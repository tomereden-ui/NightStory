import type { ScriptBlock } from "@/types";

export async function generateCoverImage(
  title: string,
  blocks: ScriptBlock[],
  apiKey: string,
  coverPrompt?: string,
): Promise<{ buf: Buffer; mimeType: string } | null> {
  // ── Step 1: build scene description ──────────────────────────────────────
  // Prefer the AI-generated coverPrompt from the story generator — it was
  // written specifically to describe the key visual moment of this story.
  // Fall back to deriving context from the script blocks.

  const characters = Array.from(
    new Set(
      blocks
        .filter((b) => b.characterName !== "SFX" && !b.characterName.toLowerCase().includes("narrat"))
        .map((b) => b.characterName),
    ),
  ).slice(0, 4);

  let scenePrompt: string;

  if (coverPrompt?.trim()) {
    // Use the story-generator's coverPrompt directly as the starting point
    scenePrompt = coverPrompt.trim();
    console.log("[CoverImage] Using story coverPrompt:", scenePrompt.slice(0, 120));
  } else {
    // Reconstruct context from blocks and ask Gemini to build a scene description
    const narratorBlocks = blocks.filter((b) => b.characterName.toLowerCase().includes("narrat"));
    const allSpeechBlocks = blocks.filter((b) => b.characterName !== "SFX");
    const pickIndices = [0, Math.floor(narratorBlocks.length / 2), narratorBlocks.length - 1];
    const narratorExcerpt = pickIndices
      .map((i) => narratorBlocks[i]?.textPayload ?? "")
      .filter(Boolean)
      .map((t) => t.replace(/\[.*?\]/g, "").trim())
      .join(" ")
      .slice(0, 300);

    // Include a broader sample of the script for better context
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

  // ── Step 2: generate image ────────────────────────────────────────────────
  const fullPrompt = `${scenePrompt}

Illustrated as a glowing monochromatic blue-and-teal cosmic night scene for a children's bedtime book cover. The characters/subject described above are large and centered, rendered as a soft silhouette or gently lit shape glowing from within against a deep navy-black night sky. Scattered stars and a faint nebula-like glow surround the subject. Square composition, dreamy bioluminescent lighting, smooth gradients, minimal flat illustration style — no warm or amber tones, only cool blues, teals, and indigo. No text, no letters, no numbers anywhere in the image.`;

  // ── Pollinations.ai — free, no key, always works ─────────────────────────
  try {
    const seed = Math.floor(Math.random() * 999999);
    const encoded = encodeURIComponent(fullPrompt.slice(0, 1500));
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=768&height=768&nologo=true&seed=${seed}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (contentType.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        console.log("[CoverImage] Generated with Pollinations.ai");
        return { buf, mimeType: contentType.split(";")[0].trim() };
      }
    }
    console.warn("[CoverImage] Pollinations returned non-image:", res.status, res.headers.get("content-type"));
  } catch (err) {
    console.warn("[CoverImage] Pollinations threw:", err);
  }

  return null;
}
