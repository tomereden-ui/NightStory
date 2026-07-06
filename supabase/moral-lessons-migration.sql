-- NightStory — Moral Lessons column migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Adds the `moral_lessons` JSONB column to stories and trash so that
-- Gemini's analysis of embedded moral/values lessons is persisted
-- per story (independent of the per-line lessonHighlight in `blocks`).
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS moral_lessons jsonb;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS moral_lessons jsonb;
