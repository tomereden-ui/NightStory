import { supabase, ensureBuckets } from "./supabase";
import type { ScriptBlock, StoryScene, VoiceGender, VoiceStyle, AgeBucket, CharacterCategory, MoralLesson } from "@/types";

export interface CharacterProfile {
  type: "child" | "adult" | "animal" | "narrator";
  visualDescription: string;
  /** Voice-casting nature — present on stories generated since nature-based voice matching shipped. */
  gender?: VoiceGender;
  voicePersona?: VoiceStyle;
  /** Age granularity beyond type's coarse child/adult/animal split (e.g. "young_adult" vs
   *  "elderly") — set by classifyCharacters, used to avoid e.g. an elderly-avatar match for a
   *  young-adult character within the same type/gender. */
  ageBucket?: AgeBucket;
  /** Splits type's catch-all "animal" (any non-human) into real kinds — set by
   *  classifyCharacters, hard-filtered in avatar matching so animals map to animals,
   *  plants to plants, objects to objects. */
  category?: CharacterCategory;
  /** Avatar-bank portrait matched to this character's profile (type/gender/ageBucket/visualDescription)
   *  via findBestAvatarForCharacter — present on stories produced since profile-based avatar
   *  matching shipped, or after an admin "Reassign Cast Avatars" retrofit. When absent, the
   *  read path falls back to deterministic hash-based bank/DiceBear selection. */
  avatarUrl?: string;
}

export interface LibraryEntry {
  id: string;
  title: string;
  summary: string;
  audioUrl?: string;   // nullable — classics may have script only, no merged audio yet
  coverUrl?: string;
  /** Percentages (0-100) — which point of coverUrl should stay in frame when
   *  cropped into a non-square container. Undefined = no custom focus set,
   *  falls back to each render site's own default object-position. */
  coverFocusX?: number;
  coverFocusY?: number;
  durationSeconds: number;
  createdAt: number;
  blocks: ScriptBlock[];
  language?: string;
  emoji?: string;      // classic stories only
  isPublic?: boolean;
  isClassic?: boolean;
  /** Admin-curated "featured on the home hero banner" flag — takes priority
   *  over the default most-recent-story placement. See home/page.tsx. */
  promoted?: boolean;
  /** True when the requesting family actually owns this row (family_id matches,
   *  or the row predates the family migration). Undefined when fetched without
   *  a familyId (no session). isPublic alone does NOT imply non-ownership — a
   *  family's own story can be public. Only getEntry() sets this. */
  isOwn?: boolean;
  childIds?: string[]; // which children this story belongs to (null = unscoped / pre-migration)
  favoritedBy?: string[]; // child profile ids who've favorited this story ("My List")
  shareMessage?: string;
  viewCount?: number;
  shareCount?: number;
  scenes?: StoryScene[];
  characterProfiles?: Record<string, CharacterProfile>;
  /** Gemini's analysis of which moral/values lessons are embedded in this story. */
  moralLessons?: MoralLesson[];
  /** True for a script saved before audio production — excluded from getEntries so it
   *  never shows up as a broken/unplayable item in Library or Home. Producing audio
   *  upserts the same row without this field, which defaults it back to false. */
  isDraft?: boolean;
  /** Shared across every chapter of a multi-part story (e.g. all 3 "Cinderella"
   *  chapters carry the same seriesId). Undefined = standalone, single-part story. */
  seriesId?: string;
  /** 1-based position within seriesId. Undefined on standalone stories. */
  chapterNumber?: number;
  /** Total chapter count in the series — denormalized onto every chapter row so
   *  list views can show "Chapter 2 of 3" without a join or count query. */
  chapterCount?: number;
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
    coverFocusX: typeof row.cover_focus_x === "number" ? row.cover_focus_x : undefined,
    coverFocusY: typeof row.cover_focus_y === "number" ? row.cover_focus_y : undefined,
    durationSeconds: row.duration_seconds ?? 0,
    createdAt: row.created_at,
    blocks: row.blocks ?? [],
    language: row.language ?? undefined,
    emoji: row.emoji ?? undefined,
    isPublic: row.is_public ?? false,
    isClassic: row.is_classic ?? false,
    promoted: row.promoted ?? false,
    childIds: Array.isArray(row.child_ids) ? row.child_ids as string[]
             : row.child_id ? [row.child_id as string]   // migrate legacy single value
             : undefined,
    favoritedBy: Array.isArray(row.favorited_by) ? row.favorited_by as string[] : undefined,
    shareMessage: row.share_message ?? undefined,
    // Post-migration, stories carry trigger-maintained counter columns; the
    // tally maps remain as the legacy fallback until the migration runs.
    viewCount: row.view_count ?? viewCounts?.[row.id] ?? 0,
    shareCount: row.share_count ?? shareCounts?.[row.id] ?? 0,
    scenes: Array.isArray(row.scenes) ? (row.scenes as StoryScene[]) : undefined,
    characterProfiles: row.character_profiles && typeof row.character_profiles === "object" && !Array.isArray(row.character_profiles)
      ? (row.character_profiles as Record<string, CharacterProfile>)
      : undefined,
    moralLessons: Array.isArray(row.moral_lessons) ? (row.moral_lessons as MoralLesson[]) : undefined,
    isDraft: row.is_draft ?? false,
    seriesId: row.series_id ?? undefined,
    chapterNumber: typeof row.chapter_number === "number" ? row.chapter_number : undefined,
    chapterCount: typeof row.chapter_count === "number" ? row.chapter_count : undefined,
  };
}

function toTrashEntry(row: any): TrashEntry { // eslint-disable-line
  return { ...toEntry(row, {}, {}), deletedAt: row.deleted_at };
}

// ─── Library ──────────────────────────────────────────────────────────────────

export async function addEntry(entry: LibraryEntry, familyId?: string): Promise<void> {
  await ensureBuckets();
  const { error } = await supabase.from("stories").upsert({
    // Stamp ownership when the caller knows it (user-facing creates). Left
    // out otherwise (classics/admin), so an upsert never nulls an existing
    // story's family_id.
    ...(familyId ? { family_id: familyId } : {}),
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    audio_url: entry.audioUrl ?? null,
    cover_url: entry.coverUrl ?? null,
    cover_focus_x: entry.coverFocusX ?? null,
    cover_focus_y: entry.coverFocusY ?? null,
    duration_seconds: entry.durationSeconds,
    created_at: entry.createdAt,
    blocks: entry.blocks,
    language: entry.language ?? null,
    emoji: entry.emoji ?? null,
    is_public: entry.isPublic ?? false,
    is_classic: entry.isClassic ?? false,
    promoted: entry.promoted ?? false,
    child_ids: entry.childIds ?? null,
    favorited_by: entry.favoritedBy ?? null,
    scenes: entry.scenes ?? null,
    character_profiles: entry.characterProfiles ?? null,
    moral_lessons: entry.moralLessons ?? null,
    is_draft: entry.isDraft ?? false,
    series_id: entry.seriesId ?? null,
    chapter_number: entry.chapterNumber ?? null,
    chapter_count: entry.chapterCount ?? null,
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

// Columns needed to render list/grid views (Home rails, Library grid). Deliberately
// excludes blocks/scenes/character_profiles/moral_lessons — the full script JSON is
// by far the heaviest part of a story row, and list views never read it. The story
// detail page fetches the full entry separately via getEntry.
const LIST_COLUMNS =
  "id, title, summary, audio_url, cover_url, duration_seconds, created_at, language, emoji, is_public, is_classic, child_ids, child_id, favorited_by, share_message, is_draft";
// Trigger-maintained counters added by the scale migration — requested
// separately so the list still works before the migration has run.
const COUNTER_COLUMNS = ", view_count, share_count";
// Same deal for the promoted-story migration — kept out of LIST_COLUMNS so
// list views don't 500 before that migration has run.
const PROMOTED_COLUMN = ", promoted";
// Same deal for the cover-focus migration.
const COVER_FOCUS_COLUMNS = ", cover_focus_x, cover_focus_y";
// Same deal for the chapters migration.
const SERIES_COLUMNS = ", series_id, chapter_number, chapter_count";
// Present since the original schema (no migration gate needed) — pulled in
// separately from LIST_COLUMNS because most list views don't need them, but
// library search does: character names (from character_profiles), mood
// (derived from scenes[].primaryMood), and moral_lessons all become
// filterable there. Still much lighter than `blocks`, the actual script text.
const SEARCH_COLUMNS = ", character_profiles, scenes, moral_lessons";

// Lightweight, family-scoped list view — one DB round trip, no script
// payloads. View/share counts come from the trigger-maintained counter
// columns (or 0 before the migration runs). Use this for anything that
// renders a list; use getEntries only when full blocks are genuinely needed.
export async function getEntrySummaries(
  familyId: string,
  opts?: { childId?: string; limit?: number },
): Promise<LibraryEntry[]> {
  const run = async (columns: string) => {
    let q = supabase
      .from("stories")
      .select(columns)
      // family_id is null only on rows created before the scale migration's
      // backfill; those were globally visible anyway, so including them here
      // is strictly no worse — and the branch matches nothing post-backfill.
      .or(`family_id.eq.${familyId},family_id.is.null`)
      .eq("is_public", false)
      .eq("is_draft", false);
    if (opts?.childId) q = q.filter("child_ids", "cs", JSON.stringify([opts.childId]));
    return q.order("created_at", { ascending: false }).limit(opts?.limit ?? 100);
  };

  let { data, error } = await run(LIST_COLUMNS + COUNTER_COLUMNS + PROMOTED_COLUMN + COVER_FOCUS_COLUMNS + SERIES_COLUMNS + SEARCH_COLUMNS);
  // Counter/promoted/cover-focus/series columns don't exist until their migrations run — retry without.
  if (error && /view_count|share_count|promoted|cover_focus|series_id|chapter_/.test(error.message)) {
    ({ data, error } = await run(LIST_COLUMNS + SEARCH_COLUMNS));
  }
  if (error) throw new Error(`getEntrySummaries: ${error.message}`);
  return (data ?? []).map((row) => toEntry(row));
}

// "All Stories" view — this family's own stories (private, same as
// getEntrySummaries) PLUS every public story (classics, community, any other
// family's stories once they've been made public). Never includes another
// family's private stories — those only match if family_id equals ours.
export async function getAllVisibleEntries(
  familyId: string,
  opts?: { limit?: number },
): Promise<LibraryEntry[]> {
  const run = async (columns: string) => {
    return supabase
      .from("stories")
      .select(columns)
      .or(`family_id.eq.${familyId},family_id.is.null,is_public.eq.true`)
      .eq("is_draft", false)
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 150);
  };

  let { data, error } = await run(LIST_COLUMNS + COUNTER_COLUMNS + PROMOTED_COLUMN + COVER_FOCUS_COLUMNS + SERIES_COLUMNS + SEARCH_COLUMNS);
  if (error && /view_count|share_count|promoted|cover_focus|series_id|chapter_/.test(error.message)) {
    ({ data, error } = await run(LIST_COLUMNS + SEARCH_COLUMNS));
  }
  if (error) throw new Error(`getAllVisibleEntries: ${error.message}`);
  return (data ?? []).map((row) => toEntry(row));
}

// Just the titles of this family's stories — used by generation routes to
// avoid duplicate titles without dragging full scripts across the wire.
export async function getEntryTitles(familyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("title")
    .or(`family_id.eq.${familyId},family_id.is.null`)
    .eq("is_public", false)
    .eq("is_draft", false);
  if (error) throw new Error(`getEntryTitles: ${error.message}`);
  return (data ?? []).map((r) => r.title as string).filter(Boolean);
}

// Full private stories including blocks. Admin/maintenance routes call this
// without a familyId (whole-table pass is their job); user-facing routes must
// pass one so the query is scoped to the caller's own family.
export async function getEntries(childId?: string, familyId?: string): Promise<LibraryEntry[]> {
  let q = supabase.from("stories").select("*").eq("is_public", false).eq("is_draft", false);
  if (familyId) q = q.eq("family_id", familyId);
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

// Fetch one story. When familyId is provided (user-facing routes), private
// stories belonging to a different family are treated as not-found; public
// stories (classics/community/shared) stay readable by anyone.
export async function getEntry(id: string, familyId?: string): Promise<LibraryEntry | undefined> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getEntry: ${error.message}`);
  if (!data) return undefined;
  if (familyId && !data.is_public && data.family_id && data.family_id !== familyId) return undefined;

  // Same ownership rule the write routes enforce (family_id matches, or the
  // row predates the family migration and has no family_id yet) — mirrored
  // here so the client can tell "my own public story" apart from "someone
  // else's public story" instead of conflating isPublic with non-ownership.
  const isOwn = familyId ? (data.family_id === familyId || !data.family_id) : undefined;

  // Trigger-maintained counters (post-migration); legacy tally as fallback.
  if (typeof data.view_count === "number") return { ...toEntry(data), isOwn };

  const [viewsResult, sharesResult] = await Promise.all([
    supabase.from("story_views").select("story_id").eq("story_id", id),
    supabase.from("story_shares").select("story_id").eq("story_id", id),
  ]);
  const viewCounts = { [id]: (viewsResult.data ?? []).length };
  const shareCounts = { [id]: (sharesResult.data ?? []).length };

  return { ...toEntry(data, viewCounts, shareCounts), isOwn };
}

// The admin-curated story to feature on every family's home hero banner
// (see /api/admin/promote-story), or null if none is currently promoted —
// including before the promoted-story migration has run, since the column
// won't exist yet.
export async function getPromotedEntry(): Promise<LibraryEntry | undefined> {
  const { data, error } = await supabase.from("stories").select("*").eq("promoted", true).limit(1).maybeSingle();
  if (error) return undefined; // column doesn't exist pre-migration, or any other lookup failure
  if (!data) return undefined;
  return toEntry(data);
}

// All chapters in a series, ordered for display (siblings list on a story
// detail page). Returns [] for a standalone story (no seriesId) rather than
// erroring, so callers can call this unconditionally.
//
// allFamilies bypasses the visibility filter entirely (every chapter
// regardless of owner or public/private) — for admin tooling, which must be
// able to see a private family's chapters too, not just public ones. Without
// it, an absent familyId defaults to public-only (the pre-existing behavior
// for the user-facing chapter row, where "no session" should only ever see
// public/classic chapters).
export async function getSeriesChapters(seriesId: string, familyId?: string, allFamilies = false): Promise<LibraryEntry[]> {
  if (!seriesId) return [];
  let q = supabase
    .from("stories")
    .select(LIST_COLUMNS + SERIES_COLUMNS)
    .eq("series_id", seriesId)
    .eq("is_draft", false);
  if (allFamilies) {
    // no visibility filter — every chapter, any owner
  } else if (familyId) {
    q = q.or(`family_id.eq.${familyId},family_id.is.null,is_public.eq.true`);
  } else {
    q = q.eq("is_public", true);
  }
  const { data, error } = await q.order("chapter_number", { ascending: true });
  if (error) throw new Error(`getSeriesChapters: ${error.message}`);
  return (data ?? []).map((row) => toEntry(row));
}

export interface ContinueEntry extends LibraryEntry {
  positionSeconds: number;
  progressPercent: number;
}

// Real "resume where you left off" data, driven by listening_progress (see
// listening-progress-migration.sql). Returns [] before that migration has
// run, rather than erroring — callers can fall back to a plain recent-stories
// list in that case. Chapter-level by design: a story that's part of a
// series still resumes at the exact chapter the child was on, not the series.
export async function getContinueListening(childId: string, familyId?: string, limit = 6): Promise<ContinueEntry[]> {
  const { data: progress, error: progressError } = await supabase
    .from("listening_progress")
    .select("story_id, position_seconds, duration_seconds, last_played_at")
    .eq("child_profile_id", childId)
    .eq("completed", false)
    .gt("position_seconds", 5)
    .order("last_played_at", { ascending: false })
    .limit(limit);
  if (progressError || !progress?.length) return [];

  const ids = progress.map((p) => p.story_id as string);
  const base = supabase.from("stories").select(LIST_COLUMNS + SERIES_COLUMNS).in("id", ids);
  const { data: rows, error: rowsError } = await (
    familyId ? base.or(`family_id.eq.${familyId},family_id.is.null,is_public.eq.true`) : base
  );
  if (rowsError || !rows?.length) return [];

  const byId = new Map(rows.map((r: any) => [r.id as string, r])); // eslint-disable-line
  return progress
    .filter((p) => byId.has(p.story_id as string))
    .map((p) => {
      const row = byId.get(p.story_id as string)!;
      const duration = (p.duration_seconds as number) || (row.duration_seconds as number) || 0;
      const position = p.position_seconds as number;
      return {
        ...toEntry(row),
        positionSeconds: position,
        progressPercent: duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0,
      };
    });
}

// ─── Trash ────────────────────────────────────────────────────────────────────

// Badge-count only — skips the TTL purge (the real trash view still runs it)
// and transfers a number instead of every deleted story's full script.
export async function getTrashCount(familyId?: string): Promise<number> {
  const cutoff = Date.now() - TRASH_TTL_MS;
  let q = supabase
    .from("trash")
    .select("id", { count: "exact", head: true })
    .gte("deleted_at", cutoff);
  if (familyId) q = q.or(`family_id.eq.${familyId},family_id.is.null`);
  const { count, error } = await q;
  if (error) throw new Error(`getTrashCount: ${error.message}`);
  return count ?? 0;
}

export async function getTrash(familyId?: string): Promise<TrashEntry[]> {
  const cutoff = Date.now() - TRASH_TTL_MS;
  await supabase.from("trash").delete().lt("deleted_at", cutoff);
  let q = supabase
    .from("trash")
    .select("*")
    .order("deleted_at", { ascending: false });
  if (familyId) q = q.or(`family_id.eq.${familyId},family_id.is.null`);
  const { data, error } = await q;
  if (error) throw new Error(`getTrash: ${error.message}`);
  return (data ?? []).map(toTrashEntry);
}

export async function moveToTrash(id: string, familyId?: string): Promise<boolean> {
  const { data } = await supabase.from("stories").select("*").eq("id", id).maybeSingle();
  if (!data) return false;
  // Ownership guard — a caller can only trash their own family's stories
  // (legacy rows with no family yet remain deletable, as before).
  if (familyId && data.family_id && data.family_id !== familyId) return false;

  const { error: insertErr } = await supabase.from("trash").upsert({ ...data, deleted_at: Date.now() });
  if (insertErr) throw new Error(`moveToTrash (insert): ${insertErr.message}`);

  const { error: deleteErr } = await supabase.from("stories").delete().eq("id", id);
  if (deleteErr) {
    // Roll back the trash insert so the story isn't duplicated in both tables.
    await supabase.from("trash").delete().eq("id", id);
    throw new Error(`moveToTrash (delete): ${deleteErr.message}`);
  }

  // Classics also cache their script/cover in the "classics" Storage bucket,
  // and /api/classics falls back to that cache when there's no DB row —
  // so without this, a deleted classic reappears as "ready" immediately.
  if (data.is_classic) {
    await supabase.storage.from("classics").remove([
      `${id}/script.json`,
      `${id}/cover.jpg`,
      `${id}/cover.png`,
    ]);
  }

  return true;
}

export async function restoreFromTrash(id: string, familyId?: string): Promise<boolean> {
  const { data } = await supabase.from("trash").select("*").eq("id", id).maybeSingle();
  if (!data) return false;
  if (familyId && data.family_id && data.family_id !== familyId) return false;
  const { deleted_at: _del, ...rest } = data; // eslint-disable-line
  const { error: insertErr } = await supabase.from("stories").upsert(rest);
  if (insertErr) throw new Error(`restoreFromTrash (insert): ${insertErr.message}`);

  const { error: deleteErr } = await supabase.from("trash").delete().eq("id", id);
  if (deleteErr) throw new Error(`restoreFromTrash (delete): ${deleteErr.message}`);
  return true;
}

export async function deleteFromTrashForever(id: string, familyId?: string): Promise<boolean> {
  const { data } = await supabase.from("trash").select("id, family_id").eq("id", id).maybeSingle();
  if (!data) return false;
  if (familyId && data.family_id && data.family_id !== familyId) return false;
  await supabase.from("trash").delete().eq("id", id);
  return true;
}

export async function emptyTrash(familyId?: string): Promise<void> {
  const q = supabase.from("trash").delete();
  const { error } = familyId
    ? await q.or(`family_id.eq.${familyId},family_id.is.null`)
    : await q.neq("id", "");
  if (error) throw new Error(`emptyTrash: ${error.message}`);
}
