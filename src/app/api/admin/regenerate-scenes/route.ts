import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry } from "@/lib/libraryStore";
import { generateScenes } from "@/lib/services/sceneGenerator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RegenerateOutcome {
  storyId: string;
  title: string;
  sceneCount: number;
  skippedReason?: string;
}

async function regenerateOne(entry: LibraryEntry, geminiKey: string): Promise<RegenerateOutcome> {
  if (!entry.blocks || entry.blocks.length === 0) {
    return { storyId: entry.id, title: entry.title, sceneCount: 0, skippedReason: "no script blocks" };
  }

  const scenes = await generateScenes(entry.blocks, geminiKey);
  if (scenes.length === 0) {
    return { storyId: entry.id, title: entry.title, sceneCount: 0, skippedReason: "scene generation failed" };
  }

  await addEntry({ ...entry, scenes });
  return { storyId: entry.id, title: entry.title, sceneCount: scenes.length };
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

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

  const results: RegenerateOutcome[] = [];
  for (const entry of entries) {
    try {
      results.push(await regenerateOne(entry, geminiKey));
    } catch (err) {
      results.push({
        storyId: entry.id,
        title: entry.title,
        sceneCount: 0,
        skippedReason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesUpdated: results.filter((r) => r.sceneCount > 0).length,
    storiesSkipped: results.filter((r) => r.sceneCount === 0).length,
    results,
  });
}
