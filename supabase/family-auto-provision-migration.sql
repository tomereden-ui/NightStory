-- Bug fix: only the original multi-user-migration.sql seed ever created a
-- family (one, for tomereden@gmail.com) — every OTHER signup since then got
-- zero rows in family_members, so any story/child-profile they created
-- either got rejected (child-profiles, library POST — both correctly check
-- for a family and 403 without one) or, for produce-drama specifically,
-- silently succeeded with family_id = NULL: a real, playable story that no
-- family-scoped query can ever find again. Stories have no per-user owner
-- column (only family_id), so once orphaned like this it's unrecoverable
-- without manual reattribution — see the backfill at the bottom for the one
-- known case (gsudai@gmail.com's "Hila and Tulitul in the Candy Kingdom").
--
-- Fix: handle_new_user() now creates a family + an owner family_members row
-- for every new signup, in the same trigger transaction as the existing
-- user_profiles insert — so a user can never exist without a family from
-- the moment their auth.users row is created.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_family_id uuid;
  v_display_name text;
BEGIN
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name');

  INSERT INTO public.user_profiles (id, display_name, email)
  VALUES (NEW.id, v_display_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.families (name)
  VALUES (COALESCE(v_display_name, 'My') || '''s Family')
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_family_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ─── Backfill: every EXISTING user who has no family yet ──────────────────────
-- (signed up before this trigger fix existed). Idempotent — only touches
-- users with zero family_members rows, so re-running this is a no-op for
-- anyone already fixed.

DO $$
DECLARE
  r record;
  v_family_id uuid;
BEGIN
  FOR r IN
    SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') AS display_name
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.user_id = u.id)
  LOOP
    INSERT INTO public.families (name)
    VALUES (COALESCE(r.display_name, 'My') || '''s Family')
    RETURNING id INTO v_family_id;

    INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (v_family_id, r.id, 'owner');

    RAISE NOTICE 'Provisioned family % for % (%)', v_family_id, r.email, r.id;

    -- Known case: gsudai@gmail.com's orphaned story (family_id NULL, created
    -- 7 minutes after his signup — the only private/non-classic orphaned
    -- story in the table) gets reattributed to the family just created for him.
    IF r.email = 'gsudai@gmail.com' THEN
      UPDATE public.stories SET family_id = v_family_id
      WHERE id = '89a87ca1-2346-4f2f-8dd0-72ab611e961e' AND family_id IS NULL;
    END IF;
  END LOOP;
END $$;
