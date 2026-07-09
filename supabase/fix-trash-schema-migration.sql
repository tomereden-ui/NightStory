-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: "Could not find the 'is_draft' column of 'trash' in the schema cache"
--
-- moveToTrash() (src/lib/libraryStore.ts) upserts the ENTIRE stories row into
-- trash as-is (spread + deleted_at). Any column added to stories without a
-- matching ALTER on trash breaks every future delete with this exact error.
-- is_draft (draft-stories-migration.sql) and view_count/share_count
-- (migration-2026-07-scale.sql) were both added to stories but never
-- mirrored onto trash. Safe to run — every statement is IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trash ADD COLUMN IF NOT EXISTS is_draft    boolean NOT NULL DEFAULT false;
ALTER TABLE public.trash ADD COLUMN IF NOT EXISTS view_count  integer NOT NULL DEFAULT 0;
ALTER TABLE public.trash ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;
