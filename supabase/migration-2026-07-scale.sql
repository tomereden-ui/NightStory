-- ═══════════════════════════════════════════════════════════════════════════
-- NightStory scale & security migration — run once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Safe to re-run: every statement is idempotent.
--
-- What this does:
--   1. Backfills family_id on legacy rows (stories / child_profiles / trash)
--      to the single existing family, closing the "legacy rows visible to
--      everyone" window the app code tolerates pre-migration.
--   2. Adds trigger-maintained view_count / share_count columns on stories,
--      so list/detail reads stop scanning the story_views / story_shares
--      tables.
--   3. Creates the jobs table so production progress survives multi-instance
--      / serverless deployments (in-memory Map is now only a cache).
--   4. Adds indexes for the hot query filters.
--   5. Enables Row Level Security on all app tables. The app's API routes use
--      the service-role key (which bypasses RLS), so nothing breaks — this
--      closes the hole where the PUBLIC anon key (shipped in the client
--      bundle) could read entire tables directly. Public stories remain
--      readable, everything else becomes service-role only.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill family_id on legacy rows ────────────────────────────────────
DO $$
DECLARE
  fam uuid;
  fam_count int;
BEGIN
  SELECT count(*) INTO fam_count FROM families;
  IF fam_count = 1 THEN
    SELECT id INTO fam FROM families LIMIT 1;
    UPDATE stories        SET family_id = fam WHERE family_id IS NULL AND is_public = false;
    UPDATE child_profiles SET family_id = fam WHERE family_id IS NULL;
    UPDATE trash          SET family_id = fam WHERE family_id IS NULL;
    RAISE NOTICE 'Backfilled family_id to % on legacy rows', fam;
  ELSE
    RAISE NOTICE 'Skipping family_id backfill: % families exist (expected exactly 1). Assign legacy rows manually.', fam_count;
  END IF;
END $$;

-- ── 2. View / share counters on stories ─────────────────────────────────────
ALTER TABLE stories ADD COLUMN IF NOT EXISTS view_count  integer NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

-- One-time backfill from the raw event tables
UPDATE stories s SET view_count = sub.c
FROM (SELECT story_id, count(*) c FROM story_views GROUP BY story_id) sub
WHERE s.id = sub.story_id AND s.view_count <> sub.c;

UPDATE stories s SET share_count = sub.c
FROM (SELECT story_id, count(*) c FROM story_shares GROUP BY story_id) sub
WHERE s.id = sub.story_id AND s.share_count <> sub.c;

-- Keep counters in sync automatically from now on
CREATE OR REPLACE FUNCTION bump_story_view_count() RETURNS trigger AS $$
BEGIN
  UPDATE stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bump_story_share_count() RETURNS trigger AS $$
BEGIN
  UPDATE stories SET share_count = share_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_view_count ON story_views;
CREATE TRIGGER trg_bump_view_count AFTER INSERT ON story_views
  FOR EACH ROW EXECUTE FUNCTION bump_story_view_count();

DROP TRIGGER IF EXISTS trg_bump_share_count ON story_shares;
CREATE TRIGGER trg_bump_share_count AFTER INSERT ON story_shares
  FOR EACH ROW EXECUTE FUNCTION bump_story_share_count();

-- ── 3. Jobs table (production progress across instances) ────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id         text PRIMARY KEY,
  status     text NOT NULL DEFAULT 'pending',
  data       jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- ── 4. Indexes for hot filters ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_family        ON stories (family_id);
CREATE INDEX IF NOT EXISTS idx_stories_list          ON stories (is_public, is_draft, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_story     ON story_views (story_id);
CREATE INDEX IF NOT EXISTS idx_story_shares_story    ON story_shares (story_id);
CREATE INDEX IF NOT EXISTS idx_trash_family          ON trash (family_id);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_at      ON trash (deleted_at);
CREATE INDEX IF NOT EXISTS idx_child_profiles_family ON child_profiles (family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user   ON family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created          ON jobs (created_at);

-- ── 5. Row Level Security ────────────────────────────────────────────────────
-- The app's API routes use the service-role key, which bypasses RLS entirely,
-- so enabling RLS changes nothing for the app itself. It blocks direct
-- PostgREST access with the public anon key (currently able to dump every
-- table). No anon/authenticated policies = no direct access, except public
-- stories which stay readable for share/community surfaces.
ALTER TABLE stories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE families              ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views           ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_shares          ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_elements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sfx_library           ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_bank           ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_preview_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public stories are readable" ON stories;
CREATE POLICY "Public stories are readable" ON stories
  FOR SELECT USING (is_public = true);
