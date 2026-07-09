// Tiny in-process TTL cache for the voices list. The table changes only when
// a voice is created/edited/deleted (rare), but the list is fetched on every
// Studio/wizard mount — and each fetch pays a full DB round trip (~0.4s+).
// Mutating routes must call invalidateVoicesCache() after any write.

const TTL_MS = 60_000;

let cached: { data: unknown[]; at: number } | null = null;

export function getCachedVoices(): unknown[] | null {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  return null;
}

export function setCachedVoices(data: unknown[]): void {
  cached = { data, at: Date.now() };
}

export function invalidateVoicesCache(): void {
  cached = null;
}
