-- NightStory — add `promoted` to `trash` (column-parity fix)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Same class of bug trash-parity-migration.sql fixed before: `trash` is
-- meant to fully mirror `stories` (moveToTrash() in libraryStore.ts copies
-- the entire stories row into trash via `{...data, deleted_at}`), but
-- promoted-story-migration.sql only added `promoted` to `stories`, not
-- `trash`. Effect: deleting ANY story fails — "Could not find the
-- 'promoted' column of 'trash' in the schema cache" — since the upsert
-- into `trash` references a column that doesn't exist there yet.
--
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS promoted boolean NOT NULL DEFAULT false;
