function buildAvatarPrompt(personDesc: string): string {
  return `Portrait headshot of ${personDesc}, looking gently at camera, soft illustrated storybook character art, semi-realistic painterly style, simple softly-lit background, subtle blue-teal cosmic glow, centered square crop, no text, no letters.`;
}

// Pollinations.ai — free, no key, same provider already used for story cover art.
export async function generateVoiceAvatar(personDesc: string): Promise<{ buf: Buffer; mimeType: string } | null> {
  const fullPrompt = buildAvatarPrompt(personDesc);
  try {
    const seed = Math.floor(Math.random() * 999999);
    const encoded = encodeURIComponent(fullPrompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=384&height=384&nologo=true&seed=${seed}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (contentType.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf, mimeType: contentType.split(";")[0].trim() };
      }
    }
    console.warn("[VoiceAvatar] Pollinations returned non-image:", res.status, res.headers.get("content-type"));
  } catch (err) {
    console.warn("[VoiceAvatar] Pollinations threw:", err);
  }
  return null;
}
