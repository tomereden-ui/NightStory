-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Tracks per-(story, child) playback position so a story can resume where a
-- child left off. Rows persist after completion (used for replay-count /
-- "recently played" history later) — never deleted on completion.

create table if not exists public.listening_progress (
  story_id text not null references public.stories(id) on delete cascade,
  child_profile_id text not null references public.child_profiles(id) on delete cascade,
  position_seconds numeric not null default 0,
  duration_seconds numeric,
  completed boolean not null default false,
  play_count int not null default 1,
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (story_id, child_profile_id)
);

-- Matches the family-scoping RLS pattern already applied to every other
-- user-data table (see multi-user-migration.sql: stories, child_profiles,
-- trash, voices, story_elements, families, family_members all have this).
-- The app's own API routes always use the service-role key server-side,
-- which bypasses RLS entirely — so this isn't the thing standing between
-- families today. It's here so this table doesn't become the one exception
-- if it's ever queried directly from the browser with the anon key, the way
-- src/app/profile/page.tsx already queries family_members directly.
-- Requires multi-user-migration.sql to have been run first (for
-- child_profiles.family_id and the public.user_family_ids() helper).
alter table public.listening_progress enable row level security;

drop policy if exists "listening_progress_all" on public.listening_progress;
create policy "listening_progress_all" on public.listening_progress using (
  child_profile_id in (
    select id from public.child_profiles
    where family_id in (select public.user_family_ids())
  )
);
