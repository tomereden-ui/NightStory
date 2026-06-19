import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";

export const dynamic = "force-dynamic";

const BUCKET = "script-saves";
const INDEX  = "index.json";

async function readIndex(): Promise<ScriptSaveMeta[]> {
  const { data } = await supabase.storage.from(BUCKET).download(INDEX);
  if (!data) return [];
  try { return JSON.parse(await data.text()) as ScriptSaveMeta[]; } catch { return []; }
}

async function writeIndex(index: ScriptSaveMeta[]): Promise<void> {
  const blob = new Blob([JSON.stringify(index)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(INDEX, blob, { upsert: true });
}

// GET /api/script-saves/[id] — return full save with blocks
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const path = id === "autosave" ? "autosave.json" : `${id}.json`;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const full = JSON.parse(await data.text()) as ScriptSaveFull;
    return NextResponse.json(full);
  } catch {
    return NextResponse.json({ error: "Corrupt data" }, { status: 500 });
  }
}

// DELETE /api/script-saves/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (id === "autosave") {
    return NextResponse.json({ error: "Cannot delete autosave" }, { status: 400 });
  }
  const path = `${id}.json`;
  await supabase.storage.from(BUCKET).remove([path]);
  const index = await readIndex();
  await writeIndex(index.filter((s) => s.id !== id));
  return NextResponse.json({ ok: true });
}
