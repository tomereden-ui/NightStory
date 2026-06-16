function buildAvatarPrompt(personDesc: string): string {
  return `Portrait headshot of ${personDesc}, looking gently at camera, soft illustrated storybook character art, semi-realistic painterly style, simple softly-lit background, subtle blue-teal cosmic glow, centered square crop, no text, no letters.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(fullPrompt: string): Promise<{ buf: Buffer; mimeType: string } | null> {
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(fullPrompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=384&height=384&nologo=true&seed=${seed}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (contentType.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf, mimeType: contentType.split(";")[0].trim() };
      }
    }
    console.warn("[VoiceAvatar] Pollinations returned non-image:", res.status, res.headers.get("content-type"));
  } finally {
    clearTimeout(timer);
  }
  return null;
}

// Pollinations.ai — free, no key, same provider already used for story cover art.
// Retries with backoff: when many avatars are requested at once (e.g. the
// Voices page rendering 8+ thumbnails simultaneously), Pollinations rate-limits
// most of the concurrent calls, so a single attempt fails for all but one.
export async function generateVoiceAvatar(personDesc: string): Promise<{ buf: Buffer; mimeType: string } | null> {
  const fullPrompt = buildAvatarPrompt(personDesc);
  const delaysMs = [0, 1500, 4000];
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    if (delaysMs[attempt] > 0) await sleep(delaysMs[attempt]);
    try {
      const result = await fetchOnce(fullPrompt);
      if (result) return result;
    } catch (err) {
      console.warn(`[VoiceAvatar] Pollinations attempt ${attempt + 1} threw:`, err);
    }
  }
  return null;
}
