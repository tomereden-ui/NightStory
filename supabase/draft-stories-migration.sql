-- NightStory — Draft stories column migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Adds the `is_draft` column to stories so a script can be persisted to the
-- database the moment it's generated in Studio, instead of living only in
-- the browser's localStorage until audio is produced. Drafts are excluded
-- from the normal library listing (getEntries) so an unproduced, audio-less
-- story never shows up as a broken/unplayable item in Library or Home.
-- Producing audio for a draft upserts the same row with is_draft left
-- unset, which defaults it back to false, promoting it to a real entry.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
