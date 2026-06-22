import { fetchPollinationsImage } from "./pollinationsClient";

function buildAvatarPrompt(personDesc: string): string {
  return `Portrait headshot of ${personDesc}, looking gently at camera, soft illustrated storybook character art, semi-realistic painterly style, simple softly-lit background, subtle blue-teal cosmic glow, centered square crop, no text, no letters.`;
}

// Pollinations.ai — free, no key, same provider already used for story cover art.
export async function generateVoiceAvatar(personDesc: string): Promise<{ buf: Buffer; mimeType: string } | null> {
  const fullPrompt = buildAvatarPrompt(personDesc);
  return fetchPollinationsImage(fullPrompt, "VoiceAvatar", { width: 384, height: 384, timeoutMs: 30_000, maxAttempts: 4 });
}
