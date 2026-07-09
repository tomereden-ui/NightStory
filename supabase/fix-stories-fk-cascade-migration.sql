-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: "update or delete on table 'stories' violates foreign key constraint
-- 'listening_progress_story_id_fkey' on table 'listening_progress'"
--
-- listening-progress-migration.sql (and story_views/story_shares in
-- RUN-ONCE-new-project-setup.sql) all define story_id as
-- "references stories(id) on delete cascade" — but those are inside
-- CREATE TABLE IF NOT EXISTS statements. If the table already existed on
-- this project (e.g. created before the cascade clause was added, or by
-- however the Supabase project migration recreated it) the IF NOT EXISTS
-- guard makes the whole statement a no-op, cascade clause included — the
-- live constraint silently stays whatever it originally was (default
-- NO ACTION), and moveToTrash's delete from `stories` fails the moment any
-- child has ever listened to that story.
--
-- This explicitly drops and recreates all three story_id foreign keys with
-- ON DELETE CASCADE regardless of their current state. Safe to run — if a
-- constraint already has the right definition, this just recreates the same
-- thing. Assumes Postgres' default constraint-naming convention
-- (confirmed for listening_progress via the actual error message).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.listening_progress DROP CONSTRAINT IF EXISTS listening_progress_story_id_fkey;
ALTER TABLE public.listening_progress
  ADD CONSTRAINT listening_progress_story_id_fkey
  FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;

ALTER TABLE public.story_views DROP CONSTRAINT IF EXISTS story_views_story_id_fkey;
ALTER TABLE public.story_views
  ADD CONSTRAINT story_views_story_id_fkey
  FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;

ALTER TABLE public.story_shares DROP CONSTRAINT IF EXISTS story_shares_story_id_fkey;
ALTER TABLE public.story_shares
  ADD CONSTRAINT story_shares_story_id_fkey
  FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;
