-- ═══════════════════════════════════════════════════════════════════════
-- NightStory — Multi-user + Family migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- PREREQUISITES (do these first in the dashboard):
--   1. Authentication → Providers → enable Email and/or Google
--   2. Authentication → Users → "Invite user" → tomereden@gmail.com
--      (or have them sign up normally)
--   3. Then run this entire script
--
-- NOTE: All existing API routes use SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS — they keep working unchanged. RLS is a defence-in-depth
-- layer that protects direct/client-side database access.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. User profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  phone           text,          -- E.164 format, e.g. "+972501234567"
  country_code    text,          -- ISO 3166-1 alpha-2, e.g. "IL", "US"
  preferred_language text NOT NULL DEFAULT 'en',
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a profile row whenever a new auth user signs up. display_name
-- is seeded from OAuth metadata when available (Google's 'full_name', or
-- 'name' as a fallback for other providers) — email/password sign-ups have
-- no name to pull from, so display_name just stays null for those.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. Families & members ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.families (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL DEFAULT 'My Family',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  family_id  uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);


-- ─── 3. Add family_id + is_public + emoji to existing tables ─────────────────

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id),
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emoji text;             -- used by classic stories

-- audio_url is nullable for script-only classics (no merged audio yet)
ALTER TABLE public.stories ALTER COLUMN audio_url DROP NOT NULL;

ALTER TABLE public.trash
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

ALTER TABLE public.voices
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

ALTER TABLE public.story_elements
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

CREATE INDEX IF NOT EXISTS idx_stories_family        ON public.stories(family_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_family ON public.child_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_voices_family         ON public.voices(family_id);


-- ─── 4. Seed: assign all existing data to tomereden@gmail.com ────────────────
--
-- Creates a family for this user, then assigns every existing story,
-- child profile, voice, and trash entry to that family.
-- Re-running this block is safe (idempotent).

DO $$
DECLARE
  v_user_id  uuid;
  v_family_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'tomereden@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE
      'User tomereden@gmail.com not found in auth.users. '
      'Sign them up first, then re-run this block.';
    RETURN;
  END IF;

  -- Ensure user_profile row exists
  INSERT INTO public.user_profiles (id, preferred_language)
  VALUES (v_user_id, 'en')
  ON CONFLICT (id) DO NOTHING;

  -- Find existing owner family or create one
  SELECT fm.family_id INTO v_family_id
  FROM public.family_members fm
  WHERE fm.user_id = v_user_id AND fm.role = 'owner'
  LIMIT 1;

  IF v_family_id IS NULL THEN
    INSERT INTO public.families (name) VALUES ('Tomer''s Family')
    RETURNING id INTO v_family_id;

    INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (v_family_id, v_user_id, 'owner');
  END IF;

  -- Assign all unowned data to this family
  UPDATE public.stories       SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.trash         SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.child_profiles SET family_id = v_family_id WHERE family_id IS NULL;
  UPDATE public.voices        SET family_id = v_family_id WHERE family_id IS NULL;

  RAISE NOTICE 'Done. family_id=%, user_id=%', v_family_id, v_user_id;
END $$;


-- ─── 5. Enable RLS on all tables ─────────────────────────────────────────────

ALTER TABLE public.stories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_elements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_bank      ENABLE ROW LEVEL SECURITY;


-- ─── 6. Helper: current user's family IDs ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_family_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT family_id FROM public.family_members
  WHERE user_id = auth.uid()
$$;


-- ─── 7. RLS policies ─────────────────────────────────────────────────────────

-- stories: public ones visible to everyone; private ones to family only
DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (
  is_public = true
  OR family_id IN (SELECT public.user_family_ids())
);
DROP POLICY IF EXISTS "stories_insert" ON public.stories;
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (
  family_id IN (SELECT public.user_family_ids())
);
DROP POLICY IF EXISTS "stories_update" ON public.stories;
CREATE POLICY "stories_update" ON public.stories FOR UPDATE USING (
  family_id IN (SELECT public.user_family_ids())
);
DROP POLICY IF EXISTS "stories_delete" ON public.stories;
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (
  family_id IN (SELECT public.user_family_ids())
);

-- trash: family-scoped (all operations)
DROP POLICY IF EXISTS "trash_all" ON public.trash;
CREATE POLICY "trash_all" ON public.trash USING (
  family_id IN (SELECT public.user_family_ids())
);

-- child_profiles: family-scoped
DROP POLICY IF EXISTS "child_profiles_all" ON public.child_profiles;
CREATE POLICY "child_profiles_all" ON public.child_profiles USING (
  family_id IN (SELECT public.user_family_ids())
);

-- voices: family-scoped
DROP POLICY IF EXISTS "voices_all" ON public.voices;
CREATE POLICY "voices_all" ON public.voices USING (
  family_id IN (SELECT public.user_family_ids())
);

-- story_elements: family-scoped
DROP POLICY IF EXISTS "story_elements_all" ON public.story_elements;
CREATE POLICY "story_elements_all" ON public.story_elements USING (
  family_id IN (SELECT public.user_family_ids())
);

-- user_profiles: each user sees and edits only their own row
DROP POLICY IF EXISTS "user_profiles_own" ON public.user_profiles;
CREATE POLICY "user_profiles_own" ON public.user_profiles USING (id = auth.uid());

-- families: visible to members
DROP POLICY IF EXISTS "families_select" ON public.families;
CREATE POLICY "families_select" ON public.families FOR SELECT USING (
  id IN (SELECT public.user_family_ids())
);

-- family_members: visible to members of the same family
DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
CREATE POLICY "family_members_select" ON public.family_members FOR SELECT USING (
  family_id IN (SELECT public.user_family_ids())
);

-- avatar_bank: always public read (no auth required)
DROP POLICY IF EXISTS "avatar_bank_read" ON public.avatar_bank;
CREATE POLICY "avatar_bank_read" ON public.avatar_bank FOR SELECT USING (true);
