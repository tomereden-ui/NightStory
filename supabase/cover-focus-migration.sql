-- Lets a user set which point of a story's cover image should stay in
-- frame when it's cropped into non-square containers (hero banners, wide
-- detail headers, etc.) — without this, object-fit: cover crops purely by
-- geometry and can cut a character's face out of frame entirely.
-- Values are percentages (0-100), consumed as CSS `object-position:
-- ${x}% ${y}%`. Null = no custom focus set, falls back to the existing
-- hardcoded default in each render site.
--
-- Added to both stories and trash — trash mirrors stories (moveToTrash()
-- copies the whole row via `{...data, deleted_at}`), skipping it here
-- would reproduce the "column of trash not found" bug from
-- promoted-story-migration.sql.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS cover_focus_x float,
  ADD COLUMN IF NOT EXISTS cover_focus_y float;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS cover_focus_x float,
  ADD COLUMN IF NOT EXISTS cover_focus_y float;
