-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)

create table if not exists public.stories (
  id text primary key,
  title text not null,
  summary text not null default '',
  audio_url text not null,
  cover_url text,
  duration_seconds float not null default 0,
  created_at bigint not null,
  blocks jsonb not null default '[]'::jsonb
);

create table if not exists public.trash (
  id text primary key,
  title text not null,
  summary text not null default '',
  audio_url text not null,
  cover_url text,
  duration_seconds float not null default 0,
  created_at bigint not null,
  deleted_at bigint not null,
  blocks jsonb not null default '[]'::jsonb
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

-- Per-element audio cache: one row per synthesised dialogue line or SFX clip.
-- Allows granular re-synthesis: only changed elements are regenerated on re-produce.
create table if not exists public.story_elements (
  id text primary key,
  story_id text not null,
  element_type text not null,            -- 'dialogue' | 'sfx'
  content_hash text not null,            -- SHA-256 of (char+line+voiceId) or (sfx desc)
  audio_url text not null,               -- public URL in element-audio bucket
  duration_ms integer not null default 0,
  character_name text,
  text_payload text not null default '',
  created_at bigint not null
);

create index if not exists idx_story_elements_lookup
  on public.story_elements (story_id, content_hash);
