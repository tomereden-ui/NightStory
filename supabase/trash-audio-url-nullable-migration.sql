-- The multi-user-migration.sql relaxed stories.audio_url to nullable
-- (to support script-only/classic stories with no merged audio yet),
-- but never applied the same relaxation to trash.audio_url.
-- This caused moveToTrash() to fail with a NOT NULL violation whenever
-- deleting a story that has no audio yet.
ALTER TABLE public.trash ALTER COLUMN audio_url DROP NOT NULL;
