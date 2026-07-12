-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Generic key/value store for small app-wide config. First use: the version
-- number shown in the Profile screen's footer (replacing the old build
-- timestamp badge). Not user/family data, so no RLS — same category as
-- voice_preview_samples / tts_engine_settings.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('app_version', '1.3.0')
on conflict (key) do nothing;
