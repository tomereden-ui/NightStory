import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

const BUCKET = "script-saves";
// Two separate index files so autosave and manual saves never contend on the
// same file — eliminating the read-modify-write race condition where a
// concurrent autosave could overwrite a freshly-written manual save index.
const AUTOSAVE_META = "autosave-meta.json"; // single entry, only autosave writes
const SAVES_INDEX   = "saves-index.json";   // list of manual saves only

const MAX_MANUAL_SAVES = 10;

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[ScriptSaves] bucket:", error.message);
  }
}

async function readAutosaveMeta(): Promise<ScriptSaveMeta | null> {
  const { data } = await supabase.storage.from(BUCKET).download(AUTOSAVE_META);
  if (!data) return null;
  try { return JSON.parse(await data.text()) as ScriptSaveMeta; } catch { return null; }
}

async function readManualIndex(): Promise<ScriptSaveMeta[]> {
  const { data } = await supabase.storage.from(BUCKET).download(SAVES_INDEX);
  if (!data) return [];
  try { return JSON.parse(await data.text()) as ScriptSaveMeta[]; } catch { return []; }
}

async function writeAutosaveMeta(meta: ScriptSaveMeta): Promise<void> {
  const blob = new Blob([JSON.stringify(meta)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(AUTOSAVE_META, blob, { upsert: true });
}

async function writeManualIndex(index: ScriptSaveMeta[]): Promise<void> {
  const blob = new Blob([JSON.stringify(index)], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(SAVES_INDEX, blob, { upsert: true });
}

async function writeSave(save: ScriptSaveFull): Promise<void> {
  const blob = new Blob([JSON.stringify(save)], { type: "application/json" });
  const path = save.isAutosave ? "autosave.json" : `${save.id}.json`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true });
  if (error) {
    console.error("[ScriptSaves] writeSave failed:", error.message, "path:", path);
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

// GET — return merged list: autosave first, then manual saves newest-first
export async function GET() {
  await ensureBucket();
  const [autosaveMeta, manuals] = await Promise.all([
    readAutosaveMeta(),
    readManualIndex(),
  ]);
  const sorted = [
    ...(autosaveMeta ? [autosaveMeta] : []),
    ...manuals.sort((a, b) => b.savedAt - a.savedAt),
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

  const now = Date.now();
  const isAutosave = Boolean(body.isAutosave);

  if (isAutosave) {
    // Autosave writes ONLY to autosave-meta.json + autosave.json.
    // It never touches saves-index.json, so it cannot overwrite manual saves.
    const meta: ScriptSaveMeta = {
      id: "autosave",
      savedAt: now,
      label: "Autosave",
      blockCount: body.blocks.length,
      summary: body.summary,
      coverUrl: body.coverUrl,
      isAutosave: true,
    };
    const full: ScriptSaveFull = { ...meta, blocks: body.blocks, coverUrl: body.coverUrl, coverPrompt: body.coverPrompt };
    await Promise.all([writeSave(full), writeAutosaveMeta(meta)]);
    return NextResponse.json({ ok: true, meta });
  } else {
    // Manual save writes ONLY to saves-index.json + its own file.
    // It never touches autosave-meta.json.
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

    // Trim oldest manual saves to stay within cap, then append new entry
    const manuals = (await readManualIndex()).sort((a, b) => a.savedAt - b.savedAt);
    const toRemove = manuals.slice(0, Math.max(0, manuals.length - MAX_MANUAL_SAVES + 1));
    if (toRemove.length > 0) {
      await supabase.storage.from(BUCKET).remove(toRemove.map((s) => `${s.id}.json`));
    }
    const kept = manuals.filter((s) => !toRemove.find((r) => r.id === s.id));
    await writeManualIndex([...kept, meta]);
    return NextResponse.json({ ok: true, meta });
  }
}
