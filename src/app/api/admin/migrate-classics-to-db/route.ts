// One-time migration: reads all already-generated classics from Storage
// and upserts them into the stories table with is_public = true.
// Safe to run multiple times (upsert is idempotent).
// Hit: GET /api/admin/migrate-classics-to-db

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CLASSIC_STORIES } from "@/lib/classicStories";
import type { ScriptBlock } from "@/types";
import { addEntry } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

const BUCKET = "classics";

function publicUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function GET() {
  const results: { id: string; status: "migrated" | "skipped" | "pending" | "trashed" }[] = [];

  // Don't resurrect a deliberately deleted classic — same trash-aware check
  // as /api/classics' GET handler.
  const { data: trashedRows } = await supabase
    .from("trash")
    .select("id")
    .eq("is_classic", true)
    .in("id", CLASSIC_STORIES.map((d) => d.id));
  const trashedIds = new Set((trashedRows ?? []).map((r) => r.id as string));

  for (const def of CLASSIC_STORIES) {
    if (trashedIds.has(def.id)) {
      results.push({ id: def.id, status: "trashed" });
      continue;
    }
    // Check Storage for script.json
    const { data: files } = await supabase.storage.from(BUCKET).list(def.id);
    const fileNames = new Set((files ?? []).map((f) => f.name));

    if (!fileNames.has("script.json")) {
      results.push({ id: def.id, status: "pending" });
      continue;
    }

    // Read script
    let blocks: ScriptBlock[] = [];
    let durationSeconds = 0;
    try {
      const { data } = await supabase.storage
        .from(BUCKET)
        .download(`${def.id}/script.json`);
      if (data) {
        const parsed = JSON.parse(await data.text()) as {
          blocks?: ScriptBlock[];
          durationSeconds?: number;
        };
        blocks = parsed.blocks ?? [];
        durationSeconds = parsed.durationSeconds ?? 0;
      }
    } catch {
      results.push({ id: def.id, status: "skipped" });
      continue;
    }

    const coverExt = fileNames.has("cover.png") ? "png" : "jpg";
    const hasCover = fileNames.has("cover.jpg") || fileNames.has("cover.png");
    const coverUrl = hasCover ? publicUrl(`${def.id}/cover.${coverExt}`) : undefined;

    await addEntry({
      id: def.id,
      title: def.title,
      summary: def.tagline,
      coverUrl,
      durationSeconds,
      createdAt: Date.now(),
      blocks,
      emoji: def.emoji,
      isPublic: true,
    });

    results.push({ id: def.id, status: "migrated" });
  }

  const counts = results.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status as keyof typeof acc] ?? 0) + 1 }),
    { migrated: 0, skipped: 0, pending: 0 }
  );

  return NextResponse.json({ ok: true, counts, results });
}
