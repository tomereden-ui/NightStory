-- sfx_library was originally created ad hoc (no tracked CREATE TABLE migration
-- exists for it — see migration-2026-07-scale.sql's RLS-only ALTER). This adds
-- a reuse counter: incremented every time a cached clip is matched via
-- findSimilarSfx() and reused for a new story instead of regenerating via
-- ElevenLabs.
ALTER TABLE sfx_library ADD COLUMN IF NOT EXISTS hit_count integer NOT NULL DEFAULT 0;
