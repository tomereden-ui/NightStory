// Shared Pollinations.ai (Flux) image-fetch helper — used by cover art and
// voice avatar generation. Pollinations is free/no-key but flaky under load
// (slow responses, occasional timeouts), so every caller retries with backoff
// instead of giving up after a single attempt.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchPollinationsImageOptions {
  width?: number;
  height?: number;
  timeoutMs?: number;
  retryDelaysMs?: number[];
}

async function fetchOnce(
  prompt: string,
  width: number,
  height: number,
  timeoutMs: number,
  label: string,
): Promise<{ buf: Buffer; mimeType: string } | null> {
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt.slice(0, 1500));
  const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=${width}&height=${height}&nologo=true&seed=${seed}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (contentType.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf, mimeType: contentType.split(";")[0].trim() };
      }
    }
    console.warn(`[${label}] Pollinations returned non-image:`, res.status, res.headers.get("content-type"));
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export async function fetchPollinationsImage(
  prompt: string,
  label: string,
  opts: FetchPollinationsImageOptions = {},
): Promise<{ buf: Buffer; mimeType: string } | null> {
  const { width = 768, height = 768, timeoutMs = 25_000, retryDelaysMs = [0, 2000] } = opts;
  for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
    if (retryDelaysMs[attempt] > 0) await sleep(retryDelaysMs[attempt]);
    try {
      const result = await fetchOnce(prompt, width, height, timeoutMs, label);
      if (result) return result;
    } catch (err) {
      console.warn(`[${label}] Pollinations attempt ${attempt + 1} threw:`, err);
    }
  }
  return null;
}
