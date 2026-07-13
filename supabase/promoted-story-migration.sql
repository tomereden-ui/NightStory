-- Add promoted flag to stories, letting an admin feature one story on the
-- home hero banner instead of it always being the most recently created one.
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS promoted boolean NOT NULL DEFAULT false;
