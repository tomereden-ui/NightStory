-- Add default_moral_lessons to child_profiles — values a parent picks once
-- (onboarding or Profile > Edit) that get pre-applied whenever a new story
-- is created for that child, same idea as favorite_themes/preferred_figures.
ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS default_moral_lessons jsonb NOT NULL DEFAULT '[]';
