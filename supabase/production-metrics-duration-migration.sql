-- Add duration_seconds to production_metrics — the final produced audio's
-- length, distinct from total_ms/stages which are pipeline wall-clock
-- timings, not output length. Null on an 'error' outcome (no audio produced).
alter table public.production_metrics
  add column if not exists duration_seconds int;
