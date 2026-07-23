-- Per-call service usage log — the accurate source of truth for API costs,
-- replacing the old cumulative-blob tracker (usage-stats/totals.json), which
-- had no per-model breakdown, no per-story attribution, and a read-modify-
-- write race that silently under-counted concurrent calls.
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).

create table if not exists public.service_usage (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: not every call is tied to a specific story (a chat message
  -- before a story exists, a voice preview, an admin standalone tool).
  story_id text,
  job_id text,
  provider text not null,        -- 'gemini' | 'elevenlabs'
  model text not null,           -- e.g. 'gemini-3.5-flash', 'gemini-3.1-pro-preview', 'eleven_v3'
  call_type text not null,       -- e.g. 'script_generation', 'hebrew_review_pass3', 'dialogue_tts', 'sfx_generation'
  input_tokens int,              -- Gemini text/JSON calls
  output_tokens int,
  characters int,                -- TTS calls (both Gemini TTS and ElevenLabs bill per character)
  audio_seconds numeric,         -- ElevenLabs sound-effects (billed per minute of output, not per char)
  units int,                     -- generic count, e.g. 1 per image
  cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_usage_story_id_idx on public.service_usage (story_id);
create index if not exists service_usage_created_at_idx on public.service_usage (created_at desc);
create index if not exists service_usage_provider_model_idx on public.service_usage (provider, model);
create index if not exists service_usage_call_type_idx on public.service_usage (call_type);

-- Service-role key (the server) bypasses RLS; enable RLS with no public
-- policies so anon/browser clients can't read or write usage rows.
alter table public.service_usage enable row level security;
