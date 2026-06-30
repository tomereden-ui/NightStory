import { supabase, ensureBuckets } from "./supabase";
import type { ScriptBlock } from "@/types";

export interface LibraryEntry {
  id: string;
  title: string;
  summary: string;
  audioUrl?: string;   // nullable — classics may have script only, no merged audio yet
  coverUrl?: string;
  durationSeconds: number;
  createdAt: number;
  blocks: ScriptBlock[];
  language?: string;
  emoji?: string;      // classic stories only
  isPublic?: boolean;
  childIds?: string[]; // which children this story belongs to (null = unscoped / pre-migration)
  shareMessage?: string;
}

export interface TrashEntry extends LibraryEntry {
  deletedAt: number;
}

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toEntry(row: any): LibraryEntry { // eslint-disable-line
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? "",
    audioUrl: row.audio_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    durationSeconds: row.duration_seconds ?? 0,
    createdAt: row.created_at,
    blocks: row.blocks ?? [],
    language: row.language ?? undefined,
    emoji: row.emoji ?? undefined,
    isPublic: row.is_public ?? false,
    childIds: Array.isArray(row.child_ids) ? row.child_ids as string[]
             : row.child_id ? [row.child_id as string]   // migrate legacy single value
             : undefined,
    shareMessage: row.share_message ?? undefined,
  };
}

function toTrashEntry(row: any): TrashEntry { // eslint-disable-line
  return { ...toEntry(row), deletedAt: row.deleted_at };
}

// ─── Library ──────────────────────────────────────────────────────────────────

export async function addEntry(entry: LibraryEntry): Promise<void> {
  await ensureBuckets();
  const { error } = await supabase.from("stories").upsert({
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    audio_url: entry.audioUrl ?? null,
    cover_url: entry.coverUrl ?? null,
    duration_seconds: entry.durationSeconds,
    created_at: entry.createdAt,
    blocks: entry.blocks,
    language: entry.language ?? null,
    emoji: entry.emoji ?? null,
    is_public: entry.isPublic ?? false,
    child_ids: entry.childIds ?? null,
  });
  if (error) throw new Error(`addEntry: ${error.message}`);
}

// User's private stories. Pass childId to scope to a specific child; omit for all.
export async function getEntries(childId?: string): Promise<LibraryEntry[]> {
  let q = supabase.from("stories").select("*").eq("is_public", false);
  if (childId) q = q.filter("child_ids", "cs", JSON.stringify([childId]));
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`getEntries: ${error.message}`);
  return (data ?? []).map(toEntry);
}

// Public (classic) stories from the DB
export async function getPublicEntries(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPublicEntries: ${error.message}`);
  return (data ?? []).map(toEntry);
}

export async function getEntry(id: string): Promise<LibraryEntry | undefined> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getEntry: ${error.message}`);
  return data ? toEntry(data) : undefined;
}

// ─── Trash ────────────────────────────────────────────────────────────────────

export async function getTrash(): Promise<TrashEntry[]> {
  const cutoff = Date.now() - TRASH_TTL_MS;
  await supabase.from("trash").delete().lt("deleted_at", cutoff);
  const { data, error } = await supabase
    .from("trash")
    .select("*")
    .order("deleted_at", { ascending: false });
  if (error) throw new Error(`getTrash: ${error.message}`);
  return (data ?? []).map(toTrashEntry);
}

export async function moveToTrash(id: string): Promise<boolean> {
  const { data } = await supabase.from("stories").select("*").eq("id", id).maybeSingle();
  if (!data) return false;

  const { error: insertErr } = await supabase.from("trash").upsert({ ...data, deleted_at: Date.now() });
  if (insertErr) throw new Error(`moveToTrash (insert): ${insertErr.message}`);

  const { error: deleteErr } = await supabase.from("stories").delete().eq("id", id);
  if (deleteErr) {
    // Roll back the trash insert so the story isn't duplicated in both tables.
    await supabase.from("trash").delete().eq("id", id);
    throw new Error(`moveToTrash (delete): ${deleteErr.message}`);
  }
  return true;
}

export async function restoreFromTrash(id: string): Promise<boolean> {
  const { data } = await supabase.from("trash").select("*").eq("id", id).maybeSingle();
  if (!data) return false;
  const { deleted_at: _del, ...rest } = data; // eslint-disable-line
  const { error: insertErr } = await supabase.from("stories").upsert(rest);
  if (insertErr) throw new Error(`restoreFromTrash (insert): ${insertErr.message}`);

  const { error: deleteErr } = await supabase.from("trash").delete().eq("id", id);
  if (deleteErr) throw new Error(`restoreFromTrash (delete): ${deleteErr.message}`);
  return true;
}

export async function deleteFromTrashForever(id: string): Promise<boolean> {
  const { data } = await supabase.from("trash").select("id").eq("id", id).maybeSingle();
  if (!data) return false;
  await supabase.from("trash").delete().eq("id", id);
  return true;
}

export async function emptyTrash(): Promise<void> {
  await supabase.from("trash").delete().neq("id", "");
}
