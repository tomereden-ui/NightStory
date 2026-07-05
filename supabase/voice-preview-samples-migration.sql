-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Shared, app-wide catalog of pre-synthesized voice preview clips — one per
-- (voice, language) pair, so the Studio voice picker can play a sample of a
-- voice actually speaking in the story's own language, not a fixed generic
-- clip. Not user/family data (same category as avatar_bank), so no RLS.

create table if not exists public.voice_preview_samples (
  voice_id text not null,
  language text not null,
  audio_url text not null,
  created_at timestamptz not null default now(),
  primary key (voice_id, language)
);
