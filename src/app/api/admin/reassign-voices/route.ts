import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry } from "@/lib/libraryStore";
import { assignVoicesToCharacters } from "@/lib/services/voiceAssignment";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ReassignOutcome {
  storyId: string;
  title: string;
  blocksChanged: number;
  skippedReason?: string;
}

/**
 * Recomputes assignedVoiceId for every block using the nature-based matcher,
 * keyed off the story's persisted characterProfiles (gender/voicePersona/type/
 * visualDescription). Every character is treated equally — existing stories
 * don't persist which character was the user-chosen "hero", so there is no
 * voice to lock; passing heroName="" disables that lock in both assign fns.
 *
 * Updates ONLY assignedVoiceId on each block. It does not touch already-
 * produced audio — a story must be re-produced for the new casting to be heard.
 */
function reassignBlocks(entry: LibraryEntry): { blocks: ScriptBlock[]; changedCount: number } {
  const characters = entry.characterProfiles ?? {};
  const voiceMap = assignVoicesToCharacters(entry.blocks, "", undefined, characters);

  let changedCount = 0;
  const blocks = entry.blocks.map((b) => {
    if (b.characterName === "SFX") return b;
    const newVoice = voiceMap[b.characterName];
    if (!newVoice || newVoice === b.assignedVoiceId) return b;
    changedCount++;
    return { ...b, assignedVoiceId: newVoice };
  });

  return { blocks, changedCount };
}

async function reassignOne(entry: LibraryEntry): Promise<ReassignOutcome> {
  // No character nature to work from — reassigning would just reshuffle
  // voices with zero improvement, so skip rather than churn the story.
  if (!entry.characterProfiles || Object.keys(entry.characterProfiles).length === 0) {
    return { storyId: entry.id, title: entry.title, blocksChanged: 0, skippedReason: "no character profile data" };
  }

  const { blocks, changedCount } = reassignBlocks(entry);
  if (changedCount > 0) {
    await addEntry({ ...entry, blocks });
  }
  return { storyId: entry.id, title: entry.title, blocksChanged: changedCount };
}

export async function POST(req: NextRequest) {
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
      results.push(await reassignOne(entry));
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
