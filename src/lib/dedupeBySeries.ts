// Collapses a list to one card per multi-chapter series — a browse/
// recommendation surface should show the whole story once, not one card per
// chapter, and always represented by chapter 1's own data (title, cover
// image, etc.) rather than whichever chapter happens to be first/last in
// the input array. Standalone (non-series) entries pass through untouched.
//
// Shared by src/app/home/page.tsx and src/app/library/page.tsx — used to be
// duplicated verbatim in both files, which is exactly the kind of place two
// copies quietly drift apart after one gets a fix the other doesn't.
export function dedupeBySeries<
  T extends { id: string; seriesId?: string; chapterNumber?: number; durationSeconds?: number; createdAt?: number },
>(entries: T[]): T[] {
  // A series card should show how long the whole story takes to listen to,
  // not just its first chapter — sum every chapter's duration up front.
  const totalDurationBySeries = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.seriesId) continue;
    totalDurationBySeries.set(entry.seriesId, (totalDurationBySeries.get(entry.seriesId) ?? 0) + (entry.durationSeconds ?? 0));
  }

  const bestBySeries = new Map<string, T>();
  const order: string[] = [];
  for (const entry of entries) {
    const key = entry.seriesId ?? entry.id;
    const existing = bestBySeries.get(key);
    if (!existing) {
      bestBySeries.set(key, entry);
      order.push(key);
      continue;
    }
    // Prefer whichever has a defined chapterNumber, then the lower one.
    // Older, pre-chapterNumber rows leave this undefined on every chapter of
    // the series — falling back to `Infinity` on both sides would make this
    // comparison always false, silently keeping whichever chapter happened
    // to be first in the (createdAt DESC) query result, i.e. the MOST
    // RECENT chapter rather than chapter 1. Break that tie by createdAt
    // ascending instead, which is the best available proxy for authoring
    // order on that legacy data.
    const entryHasNumber = entry.chapterNumber !== undefined;
    const existingHasNumber = existing.chapterNumber !== undefined;
    const better =
      entryHasNumber && existingHasNumber ? entry.chapterNumber! < existing.chapterNumber!
      : entryHasNumber !== existingHasNumber ? entryHasNumber
      : (entry.createdAt ?? Infinity) < (existing.createdAt ?? Infinity);
    if (better) bestBySeries.set(key, entry);
  }
  return order.map((key) => {
    const rep = bestBySeries.get(key)!;
    const totalDuration = rep.seriesId ? totalDurationBySeries.get(rep.seriesId) : undefined;
    return totalDuration !== undefined ? { ...rep, durationSeconds: totalDuration } : rep;
  });
}
