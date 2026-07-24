import { NextRequest, NextResponse } from "next/server";
import { getEntry, getEntries, getPublicEntries, addEntry, type LibraryEntry } from "@/lib/libraryStore";
import { deriveSummaryForStory } from "@/lib/services/storyPolicies";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface SummaryOutcome {
  storyId: string;
  title: string;
  status: "ok" | "error";
  summary?: string;
  error?: string;
}

// Summary-only counterpart to /api/admin/refresh-story — same
// storyId/title/applyAll batch shape, but re-derives just the summary
// blurb instead of the full voices+values+scenes+summary bundle.
async function regenerateOne(entry: LibraryEntry, apiKey: string): Promise<SummaryOutcome> {
  if (!entry.blocks?.length) {
    throw new Error("no script blocks");
  }
  const summary = await deriveSummaryForStory(entry.blocks, entry.title, apiKey, entry.language, entry.id);
  await addEntry({ ...entry, summary });
  return { storyId: entry.id, title: entry.title, status: "ok", summary };
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

  const results: SummaryOutcome[] = [];
  for (const entry of entries) {
    try {
      results.push(await regenerateOne(entry, apiKey));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[regenerate-summary] Failed for "${entry.title}" (${entry.id}) -- skipping:`, err);
      results.push({ storyId: entry.id, title: entry.title, status: "error", error: message });
    }
  }

  return NextResponse.json({
    totalStories: entries.length,
    storiesRegenerated: results.filter((r) => r.status === "ok").length,
    storiesFailed: results.filter((r) => r.status === "error").length,
    results,
  });
}
