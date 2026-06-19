import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

const BUCKET = "script-saves";
const INDEX  = "index.json";
const MAX_MANUAL_SAVES = 10;

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[ScriptSaves] bucket:", error.message);
  }
}

async function readIndex(): Promise<ScriptSaveMeta[]> {
  const { data } = await supabase.storage.from(BUCKET).download(INDEX);
  if (!data) return [];
  try { return JSON.parse(await data.text()) as ScriptSaveMeta[]; } catch { return []; }
}

async function writeIndex(index: ScriptSaveMeta[]): Promise<void> {
  const blob = new Blob([JSON.stringify(index)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(INDEX, blob, { upsert: true });
}

async function writeSave(save: ScriptSaveFull): Promise<void> {
  const blob = new Blob([JSON.stringify(save)], { type: "application/json" });
  const path = save.isAutosave ? "autosave.json" : `${save.id}.json`;
  await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true });
}

// GET — return index (metadata only, no blocks)
export async function GET() {
  await ensureBucket();
  const index = await readIndex();
  // newest first; autosave always first
  const sorted = [
    ...index.filter((s) => s.isAutosave),
    ...index.filter((s) => !s.isAutosave).sort((a, b) => b.savedAt - a.savedAt),
  ];
  return NextResponse.json(sorted);
}

// POST — create or upsert a save
export async function POST(req: NextRequest) {
  let body: {
    blocks: ScriptBlock[];
    summary?: string;
    coverUrl?: string;
    coverPrompt?: string;
    label?: string;
    isAutosave?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
    return NextResponse.json({ error: "blocks required" }, { status: 400 });
  }

  await ensureBucket();
  const index = await readIndex();

  const now = Date.now();
  const isAutosave = Boolean(body.isAutosave);

  if (isAutosave) {
    // Upsert single autosave entry in index
    const existingIdx = index.findIndex((s) => s.isAutosave);
    const meta: ScriptSaveMeta = {
      id: "autosave",
      savedAt: now,
      label: "Autosave",
      blockCount: body.blocks.length,
      summary: body.summary,
      coverUrl: body.coverUrl,
      isAutosave: true,
    };
    if (existingIdx >= 0) index[existingIdx] = meta;
    else index.push(meta);

    const full: ScriptSaveFull = { ...meta, blocks: body.blocks, coverUrl: body.coverUrl, coverPrompt: body.coverPrompt };
    await writeSave(full);
    await writeIndex(index);
    return NextResponse.json({ ok: true, meta });
  } else {
    // Manual save — enforce cap
    const id = `save-${now}`;
    const meta: ScriptSaveMeta = {
      id,
      savedAt: now,
      label: body.label ?? `Version · ${new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
      blockCount: body.blocks.length,
      summary: body.summary,
      coverUrl: body.coverUrl,
      isAutosave: false,
    };

    const full: ScriptSaveFull = { ...meta, blocks: body.blocks, coverUrl: body.coverUrl, coverPrompt: body.coverPrompt };
    await writeSave(full);

    // Trim old manual saves to cap, then add new one
    const manuals = index.filter((s) => !s.isAutosave).sort((a, b) => a.savedAt - b.savedAt);
    const toRemove = manuals.slice(0, Math.max(0, manuals.length - MAX_MANUAL_SAVES + 1));
    for (const s of toRemove) {
      await supabase.storage.from(BUCKET).remove([`${s.id}.json`]);
    }
    const newIndex = [
      ...index.filter((s) => s.isAutosave),
      ...manuals.filter((s) => !toRemove.find((r) => r.id === s.id)),
      meta,
    ];
    await writeIndex(newIndex);
    return NextResponse.json({ ok: true, meta });
  }
}
