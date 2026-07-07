import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry, type CharacterProfile } from "@/lib/libraryStore";
import { assignVoicesToCharacters } from "@/lib/services/voiceAssignment";
import { classifyCharacters } from "@/lib/services/characterClassifier";
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
 * Recomputes assignedVoiceId for every block. Runs a fresh classify-characters
 * analysis (type + visualDescription) for every speaking character except the
 * Narrator, then nature-scores voices from that -- always a fresh read of each
 * character's nature, not just whatever characterProfiles happened to already
 * be persisted. The Narrator is excluded from analysis and casting entirely:
 * it's forced straight to narratorVoiceId (the caller's own default narrator
 * voice -- there's no per-family narrator preference persisted server-side,
 * so this has to be supplied by whoever triggers the run).
 *
 * Updates ONLY assignedVoiceId on each block (and characterProfiles, so the
 * refreshed analysis isn't immediately stale again). Does not touch already-
 * produced audio — a story must be re-produced for the new casting to be heard.
 */
async function reassignBlocks(
  entry: LibraryEntry,
  apiKey: string,
  narratorVoiceId: string | undefined,
): Promise<{ blocks: ScriptBlock[]; characterProfiles: Record<string, CharacterProfile>; changedCount: number }> {
  // Gemini's own guidance translates the literal word "Narrator" into the
  // story's language (e.g. "קריין" in Hebrew), so a plain name check misses
  // it for any non-English story. Find the real key via characterProfiles'
  // type field instead, which survives translation, and fall back to the
  // literal "Narrator" for older entries saved before profiles were persisted.
  const narratorName = Object.entries(entry.characterProfiles ?? {}).find(([, p]) => p.type === "narrator")?.[0]
    ?? "Narrator";

  const seen = new Set<string>();
  const nonNarratorChars = entry.blocks
    .map((b) => b.characterName)
    .filter((c) => c !== "SFX" && c !== narratorName && !seen.has(c) && seen.add(c));

  let freshProfiles: Record<string, CharacterProfile> = {};
  if (nonNarratorChars.length > 0) {
    const scriptSample = entry.blocks
      .filter((b) => b.characterName !== "SFX")
      .slice(0, 40)
      .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
      .join("\n");
    const classified = await classifyCharacters(nonNarratorChars, entry.summary, scriptSample, apiKey);
    freshProfiles = Object.fromEntries(
      Object.entries(classified).map(([name, c]) => [
        name,
        { type: c.type as CharacterProfile["type"], visualDescription: c.visualDescription },
      ]),
    );
  }

  // Preserve any existing Narrator profile entry untouched — it was never analyzed here.
  const existingNarratorProfile = entry.characterProfiles?.[narratorName];
  const characterProfiles: Record<string, CharacterProfile> = {
    ...freshProfiles,
    ...(existingNarratorProfile ? { [narratorName]: existingNarratorProfile } : {}),
  };

  const voiceMap = assignVoicesToCharacters(entry.blocks, "", undefined, characterProfiles);
  if (narratorVoiceId) voiceMap[narratorName] = narratorVoiceId;

  let changedCount = 0;
  const blocks = entry.blocks.map((b) => {
    if (b.characterName === "SFX") return b;
    const newVoice = voiceMap[b.characterName];
    if (!newVoice || newVoice === b.assignedVoiceId) return b;
    changedCount++;
    return { ...b, assignedVoiceId: newVoice };
  });

  return { blocks, characterProfiles, changedCount };
}

async function reassignOne(entry: LibraryEntry, apiKey: string, narratorVoiceId: string | undefined): Promise<ReassignOutcome> {
  if (!entry.blocks?.length) {
    return { storyId: entry.id, title: entry.title, blocksChanged: 0, skippedReason: "no script blocks" };
  }

  const { blocks, characterProfiles, changedCount } = await reassignBlocks(entry, apiKey, narratorVoiceId);
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
