-- Populates user_profiles.display_name from data Supabase Auth already has —
-- Google (and most OAuth) sign-ins store the account's name in
-- auth.users.raw_user_meta_data (keys vary by provider: 'full_name' is
-- Google's, 'name' is a common fallback others use). Email/password
-- sign-ups never had a name collected at all, so those rows stay null —
-- there's nothing to import for them.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.

-- 1. Backfill existing users whose display_name is still empty.
UPDATE public.user_profiles p
SET display_name = COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') IS NOT NULL;

-- 2. From now on, auto-fill it the moment a new account is created —
-- replaces the id-only insert from multi-user-migration.sql / RUN-ONCE.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
