-- NightStory — trash.models_used parity migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- models-used-migration.sql added `models_used` to `stories`, but `trash` is
-- meant to fully mirror `stories` (moveToTrash() in libraryStore.ts copies
-- the entire stories row into trash via `{...data, deleted_at}`) and never
-- got the same column — see trash-parity-migration.sql for the same gap
-- with earlier columns. Effect: deleting ANY story failed with "Could not
-- find the 'models_used' column of 'trash' in the schema cache" (the code
-- now degrades around this by dropping unknown columns and retrying, but
-- that silently loses the model list for every trashed story until this
-- runs).
--
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS models_used jsonb;
