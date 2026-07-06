-- NightStory — Trash/Stories column parity migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- `trash` is meant to fully mirror `stories` (moveToTrash() in libraryStore.ts
-- copies the entire stories row into trash via `{...data, deleted_at}`), but
-- several columns added to `stories` over past migrations (multi-user,
-- favorites, and earlier ad-hoc changes) were never added to `trash`.
--
-- Effect of the gap: deleting ANY story failed silently — the upsert into
-- `trash` was rejected by PostgREST for referencing unknown columns, so the
-- story was never actually removed from `stories` and kept showing up in
-- the library after "deleting" it.
--
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_classic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS child_id text,
  ADD COLUMN IF NOT EXISTS child_ids jsonb,
  ADD COLUMN IF NOT EXISTS favorited_by jsonb,
  ADD COLUMN IF NOT EXISTS share_message text,
  ADD COLUMN IF NOT EXISTS character_profiles jsonb;
