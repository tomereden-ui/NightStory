-- Production performance metrics — one row per produce-drama run.
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
--
-- `stages` holds per-stage spans as millisecond offsets from the run start:
--   { "planning": {"startMs": 0, "endMs": 42000, "ms": 42000},
--     "dialogue_tts": {"startMs": 3100, "endMs": 95000, "ms": 91900}, ... }
-- Two stages whose ranges overlap ran concurrently.

create table if not exists public.production_metrics (
  id uuid primary key default gen_random_uuid(),
  story_id text,
  job_id text,
  story_title text,
  language text,
  dialogue_count int,
  sfx_count int,
  cache_dialogue_hits int,
  cache_sfx_hits int,
  skipped_lines int,
  outcome text not null default 'done',      -- 'done' | 'error'
  error_message text,
  total_ms int not null,
  stages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_metrics_created_at_idx
  on public.production_metrics (created_at desc);
create index if not exists production_metrics_story_id_idx
  on public.production_metrics (story_id);

-- Service-role key (the server) bypasses RLS; enable RLS with no public
-- policies so anon/browser clients can't read or write metric rows.
alter table public.production_metrics enable row level security;
