-- Multi-chapter story support. A chapter is just a normal `stories` row
-- tagged with a shared series_id — no new table, so every existing card/
-- player/share-page component keeps working unchanged. chapter_count is
-- denormalized (same value on every row in a series) so list views can show
-- a "Chapter 2 of 3" badge without a join or count query.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS series_id text,
  ADD COLUMN IF NOT EXISTS chapter_number integer,
  ADD COLUMN IF NOT EXISTS chapter_count integer;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS series_id text,
  ADD COLUMN IF NOT EXISTS chapter_number integer,
  ADD COLUMN IF NOT EXISTS chapter_count integer;

CREATE INDEX IF NOT EXISTS idx_stories_series ON public.stories(series_id);
