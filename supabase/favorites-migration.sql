-- Run in Supabase SQL Editor before using the "My List" favorites feature
-- Dashboard → SQL Editor → New query → paste → Run

-- Per-child favorites list, stored the same way child_ids already is (jsonb
-- array of child profile ids) rather than a native Postgres array, for
-- consistency with the existing column.
alter table public.stories
  add column if not exists favorited_by jsonb;
