import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry } from "@/lib/libraryStore";
import { reassignVoicesForStory } from "@/lib/services/storyPolicies";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ReassignOutcome {
  storyId: string;
  title: string;
  blocksChanged: number;
  skippedReason?: string;
}

async function reassignOne(entry: LibraryEntry, apiKey: string, narratorVoiceId: string | undefined): Promise<ReassignOutcome> {
  if (!entry.blocks?.length) {
    return { storyId: entry.id, title: entry.title, blocksChanged: 0, skippedReason: "no script blocks" };
  }

  const { blocks, characterProfiles, changedCount } = await reassignVoicesForStory(entry, apiKey, narratorVoiceId);
  if (changedCount > 0) {
    await addEntry({ ...entry, blocks, characterProfiles });
  }
  return { storyId: entry.id, title: entry.title, blocksChanged: changedCount };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  let body: { storyId?: string; applyAll?: boolean; narratorVoiceId?: string };
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
      results.push(await reassignOne(entry, apiKey, body.narratorVoiceId));
    } catch (err) {
      results.push({
        storyId: entry.id,
        title: entry.title,
        blocksChanged: 0,
        skippedReason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesChanged: results.filter((r) => r.blocksChanged > 0).length,
    storiesSkipped: results.filter((r) => r.blocksChanged === 0 && r.skippedReason).length,
    totalBlocksChanged: results.reduce((sum, r) => sum + r.blocksChanged, 0),
    results,
  });
}
