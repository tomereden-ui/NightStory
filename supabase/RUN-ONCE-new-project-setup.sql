-- ═══════════════════════════════════════════════════════════════════════════
-- NightStory — full schema setup for a brand-new Supabase project
-- Run once in: Dashboard → SQL Editor → New query → paste this whole file → Run
--
-- This is every migration file in /supabase, concatenated in dependency
-- order, plus two tables (story_views, story_shares) that existed on the old
-- project but were never captured in a migration file. Safe to re-run in
-- full — every statement is idempotent (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS / ON CONFLICT DO NOTHING).
--
-- ONE PREREQUISITE: enable at least one auth provider first —
--   Authentication → Sign In / Providers → enable Email (and/or Google) —
-- then sign up as tomereden@gmail.com. If you run this script before that,
-- everything still succeeds; only the "assign existing data to a family"
-- step near the end no-ops with a NOTICE, and you can just re-run this
-- entire script afterward to pick it up.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1. Base schema (schema.sql) ═══════════════════════════════════════════

create table if not exists public.stories (
  id text primary key,
  title text not null,
  summary text not null default '',
  audio_url text,
  cover_url text,
  duration_seconds float not null default 0,
  created_at bigint not null,
  blocks jsonb not null default '[]'::jsonb,
  language text,
  emoji text,
  is_public boolean not null default false,
  is_classic boolean not null default false,
  child_ids jsonb,
  scenes jsonb,
  character_profiles jsonb,
  moral_lessons jsonb
);

create table if not exists public.trash (
  id text primary key,
  title text not null,
  summary text not null default '',
  audio_url text,
  cover_url text,
  duration_seconds float not null default 0,
  created_at bigint not null,
  deleted_at bigint not null,
  blocks jsonb not null default '[]'::jsonb,
  language text,
  emoji text,
  is_public boolean not null default false,
  is_classic boolean not null default false,
  child_id text,
  child_ids jsonb,
  favorited_by jsonb,
  share_message text,
  scenes jsonb,
  character_profiles jsonb,
  moral_lessons jsonb
);

create table if not exists public.voices (
  id text primary key,
  name text not null,
  category text not null default 'family',
  type text not null default 'text',
  description text,
  gemini_voice_name text,
  el_voice_id text,
  sample_url text,
  avatar_emoji text not null default '🎙',
  created_at bigint not null
);

create table if not exists public.story_elements (
  id text primary key,
  story_id text not null,
  element_type text not null,
  content_hash text not null,
  audio_url text not null,
  duration_ms integer not null default 0,
  character_name text,
  text_payload text not null default '',
  created_at bigint not null
);

create index if not exists idx_story_elements_lookup
  on public.story_elements (story_id, content_hash);

create table if not exists public.child_profiles (
  id text primary key,
  name text not null,
  age integer not null,
  gender text not null default 'other',
  avatar_emoji text not null default '⭐',
  favorite_animals jsonb not null default '[]',
  favorite_themes jsonb not null default '[]',
  interests text,
  notes text,
  created_at bigint not null,
  updated_at bigint not null
);


-- ═══ 2. Avatar bank (avatar-bank-migration.sql) ════════════════════════════
-- Must run before section 5 (multi-user), which enables RLS on this table.

create extension if not exists vector;

create table if not exists public.avatar_bank (
  id           uuid      primary key default gen_random_uuid(),
  description  text      not null,
  prompt_embedding vector(768),
  image_url    text      not null,
  type         text      not null check (type in ('child', 'adult', 'animal')),
  gender       text      check (gender in ('boy', 'girl', 'male', 'female', 'neutral')),
  traits       text[]    not null default '{}',
  created_at   timestamptz default now()
);

-- If avatar_bank already existed (e.g. data was copied over from another
-- project before this script ran), the CREATE TABLE above no-ops and
-- whatever copied the table's structure may have dropped the vector(768)
-- dimension modifier, leaving prompt_embedding as a dimensionless `vector`.
-- The HNSW index below requires a fixed dimension to build — this restores
-- it (a no-op if it's already vector(768); the embeddings themselves are
-- untouched, this only fixes the column's declared type).
alter table public.avatar_bank alter column prompt_embedding type vector(768);

create index if not exists idx_avatar_bank_embedding
  on public.avatar_bank
  using hnsw (prompt_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create or replace function match_avatar(
  query_embedding vector(768),
  match_threshold float default 0.65
)
returns table (
  id          uuid,
  image_url   text,
  description text,
  type        text,
  gender      text,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    ab.id,
    ab.image_url,
    ab.description,
    ab.type,
    ab.gender,
    (1 - (ab.prompt_embedding <=> query_embedding))::float as similarity
  from public.avatar_bank ab
  where (1 - (ab.prompt_embedding <=> query_embedding)) > match_threshold
  order by ab.prompt_embedding <=> query_embedding
  limit 1;
end;
$$;

alter table public.child_profiles
  add column if not exists avatar_url text;


-- ═══ 3. story_views / story_shares — GAP FILL ══════════════════════════════
-- These exist on the old project (used by libraryStore.ts / the view+share
-- count endpoints) but were never captured in a migration file anywhere in
-- this repo — created ad-hoc at some point. Recreating the same shape here.

create table if not exists public.story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   text not null references public.stories(id) on delete cascade,
  viewed_at  timestamptz not null default now()
);

create table if not exists public.story_shares (
  id         uuid primary key default gen_random_uuid(),
  story_id   text not null references public.stories(id) on delete cascade,
  channel    text,
  shared_at  timestamptz not null default now()
);


-- ═══ 4. voices columns (voice-preview-samples + voice-settings) ═══════════

create table if not exists public.voice_preview_samples (
  voice_id text not null,
  language text not null,
  audio_url text not null,
  created_at timestamptz not null default now(),
  primary key (voice_id, language)
);

alter table public.voices
  add column if not exists voice_settings jsonb,
  add column if not exists preset_key text;


-- ═══ 5. stories/trash column additions (draft, favorites, lessons, scenes) ═

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- moveToTrash() (src/lib/libraryStore.ts) upserts the ENTIRE stories row into
-- trash as-is, so every column ever added to stories must be mirrored here
-- too, or the upsert fails with "Could not find the '<col>' column of
-- 'trash' in the schema cache" the next time someone deletes a story. This
-- one was missed when is_draft was added to stories.
ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

alter table public.stories
  add column if not exists favorited_by jsonb;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS moral_lessons jsonb;
ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS moral_lessons jsonb;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS scenes jsonb;
ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS scenes jsonb;


-- ═══ 6. Multi-user + family (multi-user-migration.sql) ═════════════════════

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  phone           text,
  country_code    text,
  preferred_language text NOT NULL DEFAULT 'en',
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- display_name is seeded from OAuth metadata when available (Google's
-- 'full_name', or 'name' as a fallback) — email/password sign-ups have no
-- name to pull from, so display_name just stays null for those.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.families (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL DEFAULT 'My Family',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  family_id  uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id),
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emoji text;

ALTER TABLE public.stories ALTER COLUMN audio_url DROP NOT NULL;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

ALTER TABLE public.voices
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

ALTER TABLE public.story_elements
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

CREATE INDEX IF NOT EXISTS idx_stories_family        ON public.stories(family_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_family ON public.child_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_voices_family         ON public.voices(family_id);

-- Seed: assign all existing (e.g. copied-over) data to tomereden@gmail.com's
-- family. No-ops harmlessly with a NOTICE if that user hasn't signed up yet
-- on this project — re-run this whole script after they do.
DO $$
DECLARE
  v_user_id  uuid;
  v_family_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'tomereden@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE
      'User tomereden@gmail.com not found in auth.users. '
      'Sign them up first, then re-run this script.';
    RETURN;
  END IF;

  INSERT INTO public.user_profiles (id, preferred_language)
  VALUES (v_user_id, 'en')
  ON CONFLICT (id) DO NOTHING;

  SELECT fm.family_id INTO v_family_id
  FROM public.family_members fm
  WHERE fm.user_id = v_user_id AND fm.role = 'owner'
  LIMIT 1;

  IF v_family_id IS NULL THEN
    INSERT INTO public.families (name) VALUES ('Tomer''s Family')
    RETURNING id INTO v_family_id;

    INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (v_family_id, v_user_id, 'owner');
  END IF;

  UPDATE public.stories       SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.trash         SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.child_profiles SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.voices        SET family_id = v_family_id WHERE family_id IS NULL;

  RAISE NOTICE 'Done. family_id=%, user_id=%', v_family_id, v_user_id;
END $$;

ALTER TABLE public.stories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_elements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_bank      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_family_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT family_id FROM public.family_members
  WHERE user_id = auth.uid()
$$;

DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (
  is_public = true
  OR family_id IN (SELECT public.user_family_ids())
);
DROP POLICY IF EXISTS "stories_insert" ON public.stories;
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (
  family_id IN (SELECT public.user_family_ids())
);
DROP POLICY IF EXISTS "stories_update" ON public.stories;
CREATE POLICY "stories_update" ON public.stories FOR UPDATE USING (
  family_id IN (SELECT public.user_family_ids())
);
DROP POLICY IF EXISTS "stories_delete" ON public.stories;
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (
  family_id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "trash_all" ON public.trash;
CREATE POLICY "trash_all" ON public.trash USING (
  family_id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "child_profiles_all" ON public.child_profiles;
CREATE POLICY "child_profiles_all" ON public.child_profiles USING (
  family_id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "voices_all" ON public.voices;
CREATE POLICY "voices_all" ON public.voices USING (
  family_id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "story_elements_all" ON public.story_elements;
CREATE POLICY "story_elements_all" ON public.story_elements USING (
  family_id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "user_profiles_own" ON public.user_profiles;
CREATE POLICY "user_profiles_own" ON public.user_profiles USING (id = auth.uid());

DROP POLICY IF EXISTS "families_select" ON public.families;
CREATE POLICY "families_select" ON public.families FOR SELECT USING (
  id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
CREATE POLICY "family_members_select" ON public.family_members FOR SELECT USING (
  family_id IN (SELECT public.user_family_ids())
);

DROP POLICY IF EXISTS "avatar_bank_read" ON public.avatar_bank;
CREATE POLICY "avatar_bank_read" ON public.avatar_bank FOR SELECT USING (true);


-- ═══ 7. Listening progress (listening-progress-migration.sql) ═════════════
-- Requires public.user_family_ids() from section 6.

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

alter table public.listening_progress enable row level security;

drop policy if exists "listening_progress_all" on public.listening_progress;
create policy "listening_progress_all" on public.listening_progress using (
  child_profile_id in (
    select id from public.child_profiles
    where family_id in (select public.user_family_ids())
  )
);


-- ═══ 8. Trash fixes (trash-audio-url-nullable + trash-parity) ═════════════

ALTER TABLE public.trash ALTER COLUMN audio_url DROP NOT NULL;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_classic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS child_id text,
  ADD COLUMN IF NOT EXISTS child_ids jsonb,
  ADD COLUMN IF NOT EXISTS favorited_by jsonb,
  ADD COLUMN IF NOT EXISTS share_message text,
  ADD COLUMN IF NOT EXISTS character_profiles jsonb;


-- ═══ 9. Scale migration (migration-2026-07-scale.sql) ══════════════════════
-- Counters, jobs table, indexes. family_id backfill DO block is a safe no-op
-- here (section 6's seed already handled it, or there's nothing to backfill
-- on a fresh project).

ALTER TABLE stories ADD COLUMN IF NOT EXISTS view_count  integer NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;
-- Same moveToTrash() mirroring requirement as is_draft above (section 5).
ALTER TABLE trash   ADD COLUMN IF NOT EXISTS view_count  integer NOT NULL DEFAULT 0;
ALTER TABLE trash   ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

UPDATE stories s SET view_count = sub.c
FROM (SELECT story_id, count(*) c FROM story_views GROUP BY story_id) sub
WHERE s.id = sub.story_id AND s.view_count <> sub.c;

UPDATE stories s SET share_count = sub.c
FROM (SELECT story_id, count(*) c FROM story_shares GROUP BY story_id) sub
WHERE s.id = sub.story_id AND s.share_count <> sub.c;

CREATE OR REPLACE FUNCTION bump_story_view_count() RETURNS trigger AS $$
BEGIN
  UPDATE stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bump_story_share_count() RETURNS trigger AS $$
BEGIN
  UPDATE stories SET share_count = share_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_view_count ON story_views;
CREATE TRIGGER trg_bump_view_count AFTER INSERT ON story_views
  FOR EACH ROW EXECUTE FUNCTION bump_story_view_count();

DROP TRIGGER IF EXISTS trg_bump_share_count ON story_shares;
CREATE TRIGGER trg_bump_share_count AFTER INSERT ON story_shares
  FOR EACH ROW EXECUTE FUNCTION bump_story_share_count();

CREATE TABLE IF NOT EXISTS jobs (
  id         text PRIMARY KEY,
  status     text NOT NULL DEFAULT 'pending',
  data       jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_list          ON stories (is_public, is_draft, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_story     ON story_views (story_id);
CREATE INDEX IF NOT EXISTS idx_story_shares_story    ON story_shares (story_id);
CREATE INDEX IF NOT EXISTS idx_trash_family          ON trash (family_id);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_at      ON trash (deleted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_created          ON jobs (created_at);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_preview_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. Every app table now exists, matches libraryStore.ts's toEntry()
-- mapping, and has RLS enabled (the app's own API routes use the secret/
-- service-role key server-side, which bypasses RLS, so nothing about the
-- app's behavior changes — this only blocks direct anon-key access).
-- ═══════════════════════════════════════════════════════════════════════════
