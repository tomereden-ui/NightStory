import { NextRequest, NextResponse } from "next/server";
import { getEntry, getSeriesChapters, addEntry, updateSeriesMeta, type LibraryEntry } from "@/lib/libraryStore";
import { copyCastAssignments } from "@/lib/services/storyPolicies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Adds an existing story to an existing (or brand-new) series as a specific
// chapter: stamps series_id/chapter_number/chapter_count, copies the cover
// image, and copies avatar+voice assignments from the series' already-cast
// chapter onto the new one (matched by exact character name) so a returning
// character looks and sounds identical across episodes.
export async function POST(req: NextRequest) {
  let body: { storyId?: string; seriesAnchorId?: string; chapterNumber?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { storyId, seriesAnchorId, chapterNumber } = body;
  if (!storyId || !seriesAnchorId || !chapterNumber || chapterNumber < 1) {
    return NextResponse.json({ error: "storyId, seriesAnchorId, and a chapterNumber >= 1 are required." }, { status: 400 });
  }
  if (storyId === seriesAnchorId) {
    return NextResponse.json({ error: "Can't add a story as an episode of itself." }, { status: 400 });
  }

  const [target, anchor] = await Promise.all([getEntry(storyId), getEntry(seriesAnchorId)]);
  if (!target) return NextResponse.json({ error: "Story to add not found." }, { status: 404 });
  if (!anchor) return NextResponse.json({ error: "Series story not found." }, { status: 404 });

  // The anchor may already be part of a series (reuse its series_id) or may
  // still be a standalone story — in that case it implicitly becomes chapter
  // 1 of a brand-new series right now.
  const anchorWasStandalone = !anchor.seriesId;
  const seriesId = anchor.seriesId ?? crypto.randomUUID();
  const existingChapters: LibraryEntry[] = anchor.seriesId ? await getSeriesChapters(anchor.seriesId, undefined, true) : [anchor];

  const conflict = existingChapters.find((c) => (c.chapterNumber ?? (c.id === anchor.id ? 1 : undefined)) === chapterNumber);
  if (conflict) {
    return NextResponse.json({ error: `Chapter ${chapterNumber} is already taken by "${conflict.title}" — pick a different number.` }, { status: 409 });
  }

  // Prefer whichever existing chapter already has a cast to copy from — the
  // one most recently added is the most likely to be fully assigned.
  const castSource = existingChapters.find((c) => c.characterProfiles && Object.keys(c.characterProfiles).length > 0) ?? anchor;
  const { characterProfiles, blocks, matchedCount } = copyCastAssignments(castSource, target);

  const chapterCount = existingChapters.length + 1;

  // Every chapter of a series shares one summary — both the text and (via a
  // series-scoped cache key in /api/summary-audio) the narrated audio file —
  // so switching chapters in the Library never triggers a redundant rewrite
  // or a redundant TTS synthesis. Chapter 1 is canonical; every other chapter
  // just mirrors it, here and in the backfill loop below.
  const chapterOneSummary = (
    anchorWasStandalone
      ? anchor.summary
      : existingChapters.find((c) => (c.chapterNumber ?? (c.id === anchor.id ? 1 : undefined)) === 1)?.summary
  ) ?? anchor.summary;

  await addEntry({
    ...target,
    seriesId,
    chapterNumber,
    chapterCount,
    coverUrl: castSource.coverUrl ?? target.coverUrl,
    summary: chapterOneSummary,
    characterProfiles,
    blocks,
  });

  // Keep every sibling chapter's chapter_count (and canonical summary) in
  // sync, and — if the anchor was standalone — stamp its own
  // series_id/chapter_number now too. A targeted column update, not
  // addEntry(...c) — `c` comes from getSeriesChapters, which fetches a
  // lightweight projection without blocks/character_profiles/scenes/
  // moral_lessons, and running that through addEntry's full-row upsert used to
  // blank those columns out on every sibling whenever a new chapter was linked.
  await Promise.all(
    existingChapters.map((c) => {
      const needsUpdate = c.chapterCount !== chapterCount || c.summary !== chapterOneSummary || (anchorWasStandalone && c.id === anchor.id);
      if (!needsUpdate) return Promise.resolve();
      return updateSeriesMeta(c.id, {
        seriesId,
        chapterNumber: anchorWasStandalone && c.id === anchor.id ? 1 : c.chapterNumber,
        chapterCount,
        summary: chapterOneSummary,
      });
    }),
  );

  return NextResponse.json({
    ok: true,
    seriesId,
    chapterNumber,
    chapterCount,
    castMatched: matchedCount,
    castTotal: Object.keys(target.characterProfiles ?? {}).length,
  });
}
