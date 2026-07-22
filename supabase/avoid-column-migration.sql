-- Add `avoid` to child_profiles — free-form fears/sensitivities a parent
-- notes so Gemini never includes them in a generated story (Profile > Edit
-- profile, "Things to avoid"). Missing from schema.sql/RUN-ONCE-new-project-
-- setup.sql's base table definition, same gap as default_moral_lessons and
-- pronunciation_override before it — this fills it in as its own migration
-- rather than editing the base file, consistent with how those were done.
ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS avoid text;
