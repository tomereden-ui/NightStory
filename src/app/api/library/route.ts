import { NextRequest, NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/libraryStore";
import type { ScriptBlock, StoryScene } from "@/types";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { MoralLesson } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId") ?? undefined;
  return NextResponse.json(await getEntries(childId));
}

// POST — create a draft story row the moment a script is generated in Studio,
// before audio exists. Previously a freshly-generated script lived only in
// the browser's localStorage until "Produce" ran, so a crash, a cleared
// cache, or a different browser/device meant losing it outright, and the
// "Saved Versions" history had nothing real to attach to. Producing audio
// later reuses this same id and upserts it without isDraft, which promotes
// it to a real, visible library entry.
export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    summary?: string;
    blocks: ScriptBlock[];
    language?: string;
    scenes?: StoryScene[];
    characterProfiles?: Record<string, CharacterProfile>;
    moralLessons?: MoralLesson[];
    childIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
    return NextResponse.json({ error: "blocks required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await addEntry({
    id,
    title: body.title ?? "",
    summary: body.summary ?? "",
    durationSeconds: 0,
    createdAt: Date.now(),
    blocks: body.blocks,
    language: body.language,
    scenes: body.scenes,
    characterProfiles: body.characterProfiles,
    moralLessons: body.moralLessons,
    childIds: body.childIds,
    isDraft: true,
  });

  return NextResponse.json({ id });
}
