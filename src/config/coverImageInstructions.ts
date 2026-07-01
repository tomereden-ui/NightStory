/**
 * Canonical cover image generation instructions for NightStory.
 *
 * Used by:
 *   /api/generate-cover           — preview covers shown in all 3 story creation journeys
 *   /lib/services/imageService.ts — fallback cover inside the produce-drama pipeline
 */

/** Visual style appended to every cover image prompt. */
export const COVER_STYLE_SUFFIX =
  "3D animated movie still, Pixar style, high-fidelity render, cute character design, " +
  "soft global illumination, vibrant colors, cinematic depth, magical starry night background, " +
  "no text or letters anywhere in the image.";

/** Generic fallback prompt used when the story-specific prompt triggers content filters. */
export const COVER_FALLBACK_PROMPT =
  `Whimsical fantasy creatures in an enchanted night forest, surrounded by floating glowing ` +
  `stars and warm lantern light, with a cozy magical atmosphere. ${COVER_STYLE_SUFFIX}`;

/**
 * Build the Gemini meta-prompt for rewriting a short story hint into a full image prompt.
 * Gemini's output IS the complete image prompt — it already ends with COVER_STYLE_SUFFIX.
 * Used by /api/generate-cover (all 3 user-facing creation journeys).
 */
export function buildCoverRewriterPrompt(hint: string, summary?: string): string {
  return [
    "You are a professional children's book cover illustrator. Write a safe, fantastical image prompt for this story's cover.",
    "",
    `STORY HINT: ${hint}`,
    summary ? `STORY SUMMARY:\n${summary}` : "",
    "",
    "Write ONE image generation prompt (3-4 sentences). Follow these rules strictly:",
    "",
    "1. PRESERVE & RESTYLE CHARACTERS — Keep ALL specific character names and distinctive visual details from the story hint. Restyle them as Pixar-style cartoon characters: glowing outlines, round expressive eyes, vibrant magical colors. Do NOT replace named characters with generic 'fantastical beings' — keep their identities.",
    "2. MAGICAL SCENE — the single most enchanting moment from the story. Focus on light, atmosphere, and setting.",
    "3. NIGHT-THEMED — dreamlike night setting: moon, fireflies, lanterns, bioluminescent glow, or starfields.",
    "4. CHILD-SAFE — all content must be clearly appropriate for ages 3-8. No dark, scary, or ambiguous elements. Pure joy and wonder only.",
    `5. END WITH THIS EXACT SUFFIX — "${COVER_STYLE_SUFFIX}"`,
    "",
    "Output ONLY the prompt. No explanation, no preamble.",
  ].filter(Boolean).join("\n");
}

/**
 * Build the Gemini meta-prompt for extracting a visual scene description from script blocks.
 * Gemini's output is a SCENE DESCRIPTION ONLY — wrap it with buildFinalCoverPrompt before
 * sending to the image model.
 * Used by imageService.ts (produce-drama fallback when no pre-generated cover exists).
 */
export function buildCoverScenePrompt(storyContext: string): string {
  return `You are a children's book illustrator writing an image generation prompt for a book cover.

Your job: describe the SINGLE most important visual subject of this story so an AI image generator renders it correctly.

RULES — follow in order:
1. FIRST WORD must be the main character's species or type (e.g. "Elephant", "Young girl", "Dragon", "Fox"). Never start with a setting word.
2. Then describe appearance in detail: size, color, texture, clothing or fur, expression, one unique feature.
3. Then describe what the character is DOING right now in this scene (one action).
4. Then describe the setting with exactly 2 vivid visual details behind the character.
5. End with one lighting detail — night-themed: moonlight, bioluminescent glow, fireflies, starlight, or lanterns.

IMPORTANT:
- If the main character is an animal, lead with that animal — never bury it in the description.
- DO NOT use character names. Describe by appearance only.
- 2–3 sentences total. No extra commentary.
- The result will become a children's book cover — magical, night-themed, Pixar-style.

${storyContext}

Write ONLY the image prompt text. No labels, no quotes, no intro.`;
}

/**
 * Wrap a Gemini-generated scene description into a complete image model prompt.
 * Used by imageService.ts after the scene description is produced by buildCoverScenePrompt.
 */
export function buildFinalCoverPrompt(scenePrompt: string): string {
  return (
    `${scenePrompt}\n\n` +
    `The subject described above is the MAIN FOCUS — large, centered, and unmistakable. ` +
    `Illustrated as a children's book cover. ${COVER_STYLE_SUFFIX} ` +
    `Deep cosmic night scene with rich navy-blue and teal tones. ` +
    `Soft volumetric lighting and gentle bioluminescent rim glow on the main subject. ` +
    `Scattered stars and a faint nebula in the background. ` +
    `Square composition, dreamy magical atmosphere, smooth gradients.`
  );
}
