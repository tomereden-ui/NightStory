-- Editable intro line shown on the public share page, above the cover art
-- (e.g. "Zoe's family created this amazing audio drama and wanted to share
-- it with you") — separate from the personal "message to the recipient"
-- (share_message), which appears lower on the page near the play button.
--
-- Added to BOTH stories and trash — trash is meant to fully mirror stories
-- (moveToTrash() copies the whole row via `{...data, deleted_at}`), and
-- skipping trash here would reproduce the exact "Could not find the column
-- of 'trash' in the schema cache" bug promoted-story-migration.sql caused.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS intro_message text;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS intro_message text;
