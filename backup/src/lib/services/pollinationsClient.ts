// Shared Pollinations.ai (Flux) image-fetch helper — used by cover art and
// voice avatar generation. Pollinations is free/no-key but rate-limited under
// concurrent load (429). We retry with 429-aware backoff.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchPollinationsImageOptions {
  width?: number;
  height?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

type FetchOnceResult =
  | { ok: true; buf: Buffer; mimeType: string }
  | { ok: false; status: number; retryAfterMs?: number };

async function fetchOnce(
  prompt: string,
  width: number,
  height: number,
  timeoutMs: number,
  label: string,
): Promise<FetchOnceResult> {
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt.slice(0, 1500));
  const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (contentType.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { ok: true, buf, mimeType: contentType.split(";")[0].trim() };
      }
      console.warn(`[${label}] Pollinations returned non-image:`, res.status, contentType);
      return { ok: false, status: res.status };
    }
    // Parse Retry-After on 429
    let retryAfterMs: number | undefined;
    if (res.status === 429) {
      const ra = res.headers.get("retry-after");
      if (ra) retryAfterMs = (isNaN(Number(ra)) ? 10 : Number(ra)) * 1000;
    }
    console.warn(`[${label}] Pollinations returned non-image:`, res.status, res.headers.get("content-type"));
    return { ok: false, status: res.status, retryAfterMs };
  } catch (err) {
    console.warn(`[${label}] Pollinations fetch threw:`, err);
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPollinationsImage(
  prompt: string,
  label: string,
  opts: FetchPollinationsImageOptions = {},
): Promise<{ buf: Buffer; mimeType: string } | null> {
  const { width = 768, height = 768, timeoutMs = 30_000, maxAttempts = 5 } = opts;

  // Base delays between retries (ms); 429 overrides these with longer waits
  const BASE_DELAYS = [0, 4_000, 8_000, 15_000, 25_000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_DELAYS[attempt] ?? 15_000);
    }

    const result = await fetchOnce(prompt, width, height, timeoutMs, label);

    if (result.ok) return { buf: result.buf, mimeType: result.mimeType };

    // On 429, honour Retry-After (or default to 10s) before next attempt
    if (result.status === 429) {
      const wait = result.retryAfterMs ?? 10_000;
      console.warn(`[${label}] Rate limited (429). Waiting ${wait}ms before retry ${attempt + 1}/${maxAttempts - 1}`);
      await sleep(wait);
      // Don't double-wait — skip the BASE_DELAYS sleep on next loop by
      // temporarily resetting to avoid extra delay (we already waited above)
      BASE_DELAYS[attempt + 1] = 0;
    }
  }

  return null;
}
