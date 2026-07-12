import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry } from "@/lib/libraryStore";
import { reassignAvatarsForStory } from "@/lib/services/storyPolicies";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ReassignOutcome {
  storyId: string;
  title: string;
  avatarsChanged: number;
  skippedReason?: string;
}

async function reassignOne(entry: LibraryEntry, apiKey: string): Promise<ReassignOutcome> {
  if (!entry.blocks?.length) {
    return { storyId: entry.id, title: entry.title, avatarsChanged: 0, skippedReason: "no script blocks" };
  }

  const { characterProfiles, changedCount } = await reassignAvatarsForStory(entry, apiKey);
  if (changedCount > 0) {
    await addEntry({ ...entry, characterProfiles });
  }
  return { storyId: entry.id, title: entry.title, avatarsChanged: changedCount };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  let body: { storyId?: string; applyAll?: boolean };
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
  } else if (body.applyAll) {
    const [priv, pub] = await Promise.all([getEntries(), getPublicEntries()]);
    entries = [...priv, ...pub];
  } else {
    return NextResponse.json({ error: "Provide storyId or applyAll." }, { status: 400 });
  }

  const results: ReassignOutcome[] = [];
  for (const entry of entries) {
    try {
      results.push(await reassignOne(entry, apiKey));
    } catch (err) {
      results.push({
        storyId: entry.id,
        title: entry.title,
        avatarsChanged: 0,
        skippedReason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesChanged: results.filter((r) => r.avatarsChanged > 0).length,
    storiesSkipped: results.filter((r) => r.avatarsChanged === 0 && r.skippedReason).length,
    totalAvatarsChanged: results.reduce((sum, r) => sum + r.avatarsChanged, 0),
    results,
  });
}
