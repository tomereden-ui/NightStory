import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ScriptSaveFull, ScriptSaveMeta } from "@/lib/scriptSaves";

export const dynamic = "force-dynamic";

const BUCKET     = "script-saves";
const SAVES_INDEX = "saves-index.json";

async function readManualIndex(storyId: string): Promise<ScriptSaveMeta[]> {
  const { data } = await supabase.storage.from(BUCKET).download(`${storyId}/${SAVES_INDEX}`);
  if (!data) return [];
  try { return JSON.parse(await data.text()) as ScriptSaveMeta[]; } catch { return []; }
}

async function writeManualIndex(storyId: string, index: ScriptSaveMeta[]): Promise<void> {
  const blob = new Blob([JSON.stringify(index)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(`${storyId}/${SAVES_INDEX}`, blob, { upsert: true });
}

// GET /api/script-saves/[id]?storyId=... — return full save with blocks
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const storyId = req.nextUrl.searchParams.get("storyId");
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const path = `${storyId}/${id === "autosave" ? "autosave.json" : `${id}.json`}`;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error("[ScriptSaves] GET missing file:", path, error?.message);
    // Auto-clean phantom index entries so they stop appearing in the list
    if (id !== "autosave") {
      const manuals = await readManualIndex(storyId);
      if (manuals.some((s) => s.id === id)) {
        await writeManualIndex(storyId, manuals.filter((s) => s.id !== id));
        console.warn("[ScriptSaves] removed phantom entry:", id);
      }
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const full = JSON.parse(await data.text()) as ScriptSaveFull;
    return NextResponse.json(full);
  } catch {
    return NextResponse.json({ error: "Corrupt data" }, { status: 500 });
  }
}

// DELETE /api/script-saves/[id]?storyId=... — only touches saves-index.json, never autosave-meta.json
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const storyId = req.nextUrl.searchParams.get("storyId");
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (id === "autosave") {
    return NextResponse.json({ error: "Cannot delete autosave" }, { status: 400 });
  }
  const [, manuals] = await Promise.all([
    supabase.storage.from(BUCKET).remove([`${storyId}/${id}.json`]),
    readManualIndex(storyId),
  ]);
  await writeManualIndex(storyId, manuals.filter((s) => s.id !== id));
  return NextResponse.json({ ok: true });
}
