-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Adds matching granularity to the avatar bank:
--
--   age_bucket: so matching can distinguish e.g. a "young prince" from an
--   "elderly grandfather" instead of both collapsing into "adult/male".
--
--   category: the existing type column's "animal" is really "any non-human"
--   (trees, balloons, robots and dragons all share it), which let a tree
--   character draw from the same pool as pigs. category splits non-humans
--   properly: human | animal | plant | object | fantasy.
--
-- Both nullable — backfilled via POST /api/admin/backfill-avatar-ages
-- (Gemini reads each existing description and classifies it), not set at
-- migration time.

alter table public.avatar_bank
  add column if not exists age_bucket text,
  add column if not exists category text;
