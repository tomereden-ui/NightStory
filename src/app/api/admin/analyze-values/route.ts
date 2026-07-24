import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, updateMoralLessons, type LibraryEntry } from "@/lib/libraryStore";
import { analyzeLessonsForStory } from "@/lib/services/storyPolicies";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface AnalyzeOutcome {
  storyId: string;
  title: string;
  status: "ok" | "error";
  lessonCount?: number;
  error?: string;
}

// Values-only counterpart to /api/admin/refresh-story — that route re-runs
// voices/values/scenes/summary together in one bundle, which is expensive
// (4 Gemini calls per story) when all an admin wants is to reclassify a
// story's embedded values against the current 10-value catalog (e.g. after
// the catalog itself changes, or for older stories analyzed before this
// pipeline existed). Same storyId/title/applyAll batch shape as
// refresh-story, and the same "one failure doesn't abort the batch" handling.
async function analyzeOne(entry: LibraryEntry, apiKey: string): Promise<AnalyzeOutcome> {
  if (!entry.blocks?.length) {
    throw new Error("no script blocks");
  }
  const lessons = await analyzeLessonsForStory(entry.blocks, apiKey, entry.language, entry.id);
  await updateMoralLessons(entry.id, lessons);
  return { storyId: entry.id, title: entry.title, status: "ok", lessonCount: lessons.length };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  let body: { storyId?: string; title?: string; applyAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let entries: LibraryEntry[];
  if (body.storyId) {
    const entry = await getEntry(body.storyId);
    if (!entry) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    entries = [entry];
  } else if (body.title?.trim()) {
    const [priv, pub] = await Promise.all([getEntries(), getPublicEntries()]);
    const needle = body.title.trim().toLowerCase();
    const seen = new Set<string>();
    entries = [...priv, ...pub].filter((e) => {
      if (seen.has(e.id) || !e.title.toLowerCase().includes(needle)) return false;
      seen.add(e.id);
      return true;
    });
    if (entries.length === 0) return NextResponse.json({ error: `No story title matches "${body.title}".` }, { status: 404 });
  } else if (body.applyAll) {
    const [priv, pub] = await Promise.all([getEntries(), getPublicEntries()]);
    const seen = new Set<string>();
    entries = [...priv, ...pub].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  } else {
    return NextResponse.json({ error: "Provide storyId, title, or applyAll." }, { status: 400 });
  }

  const results: AnalyzeOutcome[] = [];
  for (const entry of entries) {
    try {
      results.push(await analyzeOne(entry, apiKey));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[analyze-values] Failed for "${entry.title}" (${entry.id}) -- skipping:`, err);
      results.push({ storyId: entry.id, title: entry.title, status: "error", error: message });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesAnalyzed: results.filter((r) => r.status === "ok").length,
    storiesFailed: results.filter((r) => r.status === "error").length,
    results,
  });
}
