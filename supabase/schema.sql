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
