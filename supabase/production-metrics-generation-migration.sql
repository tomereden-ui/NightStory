-- Add script_generation_ms to production_metrics — how long the raw script
-- generation step alone took (the Gemini generateContent retry loop in
-- generate-story/five-question-story), distinct from total_ms (the later
-- audio-production pipeline's own wall-clock) and from stages (which now
-- also gets a "script_generation" span recorded at the same time — see
-- markScriptDone in src/lib/perfMetrics.ts). Null for admin-pasted scripts,
-- which have no generation step to time.
alter table public.production_metrics
  add column if not exists script_generation_ms int;
