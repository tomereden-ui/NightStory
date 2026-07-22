-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
--
-- Adds models_used to stories: every distinct AI model actually used to
-- produce that story (script/casting text model, TTS model(s) — a fallback
-- chain means more than one can appear for a single story, cover image
-- model, SFX). Populated going forward by produce-drama/route.ts's
-- `modelsUsed` set; existing stories will have this as null until
-- reproduced (no retroactive backfill — unlike duration, there's no way to
-- re-derive which models an already-finished story used after the fact).

alter table public.stories
  add column if not exists models_used jsonb;
