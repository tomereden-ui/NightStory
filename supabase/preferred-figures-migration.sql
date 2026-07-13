-- Add preferred_figures column to child_profiles, capturing which
-- storybook figures (prince, dragon, robot, etc.) a child picked during onboarding
ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS preferred_figures jsonb NOT NULL DEFAULT '[]';
