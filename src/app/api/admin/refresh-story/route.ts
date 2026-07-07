import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry } from "@/lib/libraryStore";
import { reassignVoicesForStory, analyzeLessonsForStory, deriveSummaryForStory } from "@/lib/services/storyPolicies";
import { generateScenes } from "@/lib/services/sceneGenerator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RefreshOutcome {
  storyId: string;
  title: string;
  status: "ok" | "error";
  changes?: { voicesRecast: number; lessonCount: number; sceneCount: number };
  error?: string;
}

/**
 * Re-applies every generation-time "policy" to an already-produced story
 * without touching its script text, cover image, or audio: cast/voice
 * assignment, moral-lesson analysis, scene segmentation, and the summary
 * blurb. Each story is processed independently -- one failing (a bad Gemini
 * response, a transient network error, whatever) is logged and skipped
 * rather than aborting the whole batch.
 */
async function refreshOne(entry: LibraryEntry, apiKey: string, narratorVoiceId: string | undefined): Promise<RefreshOutcome> {
  if (!entry.blocks?.length) {
    throw new Error("no script blocks");
  }

  const [{ blocks, characterProfiles, changedCount }, moralLessons, scenes, summary] = await Promise.all([
    reassignVoicesForStory(entry, apiKey, narratorVoiceId),
    analyzeLessonsForStory(entry.blocks, apiKey, entry.language),
    generateScenes(entry.blocks, apiKey),
    deriveSummaryForStory(entry.blocks, entry.title, apiKey, entry.language),
  ]);
  // generateScenes swallows its own errors and returns [] rather than
  // throwing, so treat an empty result here as this story's failure (a real
  // story should never end up with zero scenes) instead of silently saving
  // a blank scene map and reporting success.
  if (scenes.length === 0) {
    throw new Error("scene generation failed");
  }

  await addEntry({ ...entry, blocks, characterProfiles, moralLessons, scenes, summary });

  return {
    storyId: entry.id,
    title: entry.title,
    status: "ok",
    changes: { voicesRecast: changedCount, lessonCount: moralLessons.length, sceneCount: scenes.length },
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  let body: { storyId?: string; title?: string; applyAll?: boolean; narratorVoiceId?: string };
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

  const results: RefreshOutcome[] = [];
  for (const entry of entries) {
    try {
      results.push(await refreshOne(entry, apiKey, body.narratorVoiceId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[refresh-story] Failed for "${entry.title}" (${entry.id}) -- skipping:`, err);
      results.push({ storyId: entry.id, title: entry.title, status: "error", error: message });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesRefreshed: results.filter((r) => r.status === "ok").length,
    storiesFailed: results.filter((r) => r.status === "error").length,
    results,
  });
}
