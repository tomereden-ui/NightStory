import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry, type CharacterProfile } from "@/lib/libraryStore";
import { classifyCharacters } from "@/lib/services/characterClassifier";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface BackfillOutcome {
  storyId: string;
  title: string;
  charactersProfiled: number;
  skippedReason?: string;
}

/**
 * Backfills characterProfiles (type, gender, ageBucket, visualDescription) for
 * stories generated before the nature-based voice-matching / profile-based
 * avatar-matching systems existed. Skips anything that already has profile
 * data, and skips any story with no audio yet (audioUrl null) — an unproduced
 * script isn't worth spending a Gemini call on since it may still be actively
 * edited or abandoned, and produce-drama/reassign-voices already handle the
 * produced path.
 */
async function backfillOne(entry: LibraryEntry, apiKey: string): Promise<BackfillOutcome> {
  if (!entry.audioUrl) {
    return { storyId: entry.id, title: entry.title, charactersProfiled: 0, skippedReason: "no audio yet" };
  }
  if (entry.characterProfiles && Object.keys(entry.characterProfiles).length > 0) {
    return { storyId: entry.id, title: entry.title, charactersProfiled: 0, skippedReason: "already has character profile data" };
  }
  if (!entry.blocks?.length) {
    return { storyId: entry.id, title: entry.title, charactersProfiled: 0, skippedReason: "no script blocks" };
  }

  const seen = new Set<string>();
  const characters = entry.blocks
    .map((b) => b.characterName)
    .filter((c) => c !== "SFX" && !seen.has(c) && seen.add(c));
  if (!characters.length) {
    return { storyId: entry.id, title: entry.title, charactersProfiled: 0, skippedReason: "no speaking characters" };
  }

  const scriptSample = entry.blocks
    .filter((b) => b.characterName !== "SFX")
    .slice(0, 40)
    .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
    .join("\n");

  const classified = await classifyCharacters(characters, entry.summary, scriptSample, apiKey);
  const characterProfiles = Object.fromEntries(
    Object.entries(classified).map(([name, c]) => [
      name,
      {
        type: c.type as "child" | "adult" | "animal" | "narrator",
        visualDescription: c.visualDescription,
        gender: c.gender as CharacterProfile["gender"],
        ageBucket: c.ageBucket,
        category: c.category,
      },
    ]),
  );

  await addEntry({ ...entry, characterProfiles });
  return { storyId: entry.id, title: entry.title, charactersProfiled: Object.keys(characterProfiles).length };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

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

  const results: BackfillOutcome[] = [];
  for (const entry of entries) {
    try {
      results.push(await backfillOne(entry, apiKey));
    } catch (err) {
      results.push({
        storyId: entry.id,
        title: entry.title,
        charactersProfiled: 0,
        skippedReason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesBackfilled: results.filter((r) => r.charactersProfiled > 0).length,
    storiesSkipped: results.filter((r) => r.charactersProfiled === 0).length,
    results,
  });
}
