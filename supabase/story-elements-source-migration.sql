-- Lets "how many cached SFX/dialogue clips did we reuse vs generate fresh"
-- actually be answerable by querying the DB, instead of only existing as an
-- in-memory counter that gets console.logged once and thrown away.
--
-- source: which path created this row —
--   'generated'   — freshly synthesized/generated for this story
--   'sfx_library' — reused a semantically-similar clip from a DIFFERENT
--                   story via the cross-story sfx_library, then copied into
--                   this story's row
-- hit_count: how many times an existing row was reused within the SAME
--   story across repeated productions (a dialogue/SFX cache hit never
--   inserts a new row, so this is the only way to see that activity at all).
--
-- Not mirrored to `trash` — story_elements isn't part of the stories/trash
-- parity system (see trash-parity-migration.sql's comment for that pattern);
-- it's an independent per-story cache table with no trash concept.

ALTER TABLE public.story_elements
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS hit_count integer NOT NULL DEFAULT 0;
