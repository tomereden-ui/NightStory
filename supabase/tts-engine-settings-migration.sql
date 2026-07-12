-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Admin-configurable on/off switch per TTS engine, driven from the Voice
-- Manager screen's Engine Settings panel. Controls (a) which voice pools are
-- offered for assignment in Studio (see src/lib/services/voiceCatalog.ts) and
-- (b) which Gemini model version / whether the Chirp3-HD fallback production
-- synthesis is allowed to use (see src/lib/services/ttsService.ts). Not
-- user/family data, so no RLS — same category as voice_preview_samples.

create table if not exists public.tts_engine_settings (
  engine text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed rows matching current production behavior exactly, so running this
-- migration changes nothing until an admin actively flips a checkbox.
-- gemini31 defaults OFF since production has never used it before this panel.
insert into public.tts_engine_settings (engine, enabled) values
  ('gemini25', true),
  ('gemini31', false),
  ('elevenlabs', true),
  ('chirp3hd', true)
on conflict (engine) do nothing;
