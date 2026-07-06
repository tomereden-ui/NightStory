import { supabase, ensureBuckets } from "./supabase";
import type { ScriptBlock, StoryScene, VoiceGender, VoiceStyle, MoralLesson } from "@/types";

export interface CharacterProfile {
  type: "child" | "adult" | "animal" | "narrator";
  visualDescription: string;
  /** Voice-casting nature — present on stories generated since nature-based voice matching shipped. */
  gender?: VoiceGender;
  voicePersona?: VoiceStyle;
}

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
  isClassic?: boolean;
  childIds?: string[]; // which children this story belongs to (null = unscoped / pre-migration)
  favoritedBy?: string[]; // child profile ids who've favorited this story ("My List")
  shareMessage?: string;
  viewCount?: number;
  shareCount?: number;
  scenes?: StoryScene[];
  characterProfiles?: Record<string, CharacterProfile>;
  /** Gemini's analysis of which moral/values lessons are embedded in this story. */
  moralLessons?: MoralLesson[];
}

export interface TrashEntry extends LibraryEntry {
  deletedAt: number;
}

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toEntry(row: any, viewCounts?: Record<string, number>, shareCounts?: Record<string, number>): LibraryEntry { // eslint-disable-line
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
    isClassic: row.is_classic ?? false,
    childIds: Array.isArray(row.child_ids) ? row.child_ids as string[]
             : row.child_id ? [row.child_id as string]   // migrate legacy single value
             : undefined,
    favoritedBy: Array.isArray(row.favorited_by) ? row.favorited_by as string[] : undefined,
    shareMessage: row.share_message ?? undefined,
    viewCount: viewCounts?.[row.id] ?? 0,
    shareCount: shareCounts?.[row.id] ?? 0,
    scenes: Array.isArray(row.scenes) ? (row.scenes as StoryScene[]) : undefined,
    characterProfiles: row.character_profiles && typeof row.character_profiles === "object" && !Array.isArray(row.character_profiles)
      ? (row.character_profiles as Record<string, CharacterProfile>)
      : undefined,
    moralLessons: Array.isArray(row.moral_lessons) ? (row.moral_lessons as MoralLesson[]) : undefined,
  };
}

function toTrashEntry(row: any): TrashEntry { // eslint-disable-line
  return { ...toEntry(row, {}, {}), deletedAt: row.deleted_at };
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
    is_classic: entry.isClassic ?? false,
    child_ids: entry.childIds ?? null,
    favorited_by: entry.favoritedBy ?? null,
    scenes: entry.scenes ?? null,
    character_profiles: entry.characterProfiles ?? null,
    moral_lessons: entry.moralLessons ?? null,
  });
  if (error) throw new Error(`addEntry: ${error.message}`);
}

// Update just the moral-lessons analysis for an already-saved story, without
// touching anything else — used when the panel re-analyzes an existing story
// (e.g. after the user adds/removes a lesson) and doesn't have a full entry
// to upsert.
export async function updateMoralLessons(id: string, moralLessons: MoralLesson[]): Promise<void> {
  const { error } = await supabase.from("stories").update({ moral_lessons: moralLessons }).eq("id", id);
  if (error) throw new Error(`updateMoralLessons: ${error.message}`);
}

// User's private stories. Pass childId to scope to a specific child; omit for all.
export async function getEntries(childId?: string): Promise<LibraryEntry[]> {
  let q = supabase.from("stories").select("*").eq("is_public", false);
  if (childId) q = q.filter("child_ids", "cs", JSON.stringify([childId]));
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`getEntries: ${error.message}`);

  const ids = (data ?? []).map((r) => r.id as string);
  const [viewsResult, sharesResult] = ids.length > 0
    ? await Promise.all([
        supabase.from("story_views").select("story_id").in("story_id", ids),
        supabase.from("story_shares").select("story_id").in("story_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const viewCounts = (viewsResult.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.story_id as string] = (acc[r.story_id as string] ?? 0) + 1;
    return acc;
  }, {});
  const shareCounts = (sharesResult.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.story_id as string] = (acc[r.story_id as string] ?? 0) + 1;
    return acc;
  }, {});

  return (data ?? []).map((row) => toEntry(row, viewCounts, shareCounts));
}

// Public (classic) stories from the DB
export async function getPublicEntries(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPublicEntries: ${error.message}`);
  return (data ?? []).map((row) => toEntry(row));
}

export async function getEntry(id: string): Promise<LibraryEntry | undefined> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getEntry: ${error.message}`);
  if (!data) return undefined;

  const [viewsResult, sharesResult] = await Promise.all([
    supabase.from("story_views").select("story_id").eq("story_id", id),
    supabase.from("story_shares").select("story_id").eq("story_id", id),
  ]);
  const viewCounts = { [id]: (viewsResult.data ?? []).length };
  const shareCounts = { [id]: (sharesResult.data ?? []).length };

  return toEntry(data, viewCounts, shareCounts);
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
