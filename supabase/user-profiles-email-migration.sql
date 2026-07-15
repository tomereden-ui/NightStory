-- Adds user_profiles.email, denormalized from auth.users.email so it's
-- queryable without a join. Kept in sync going forward by two triggers:
-- one on new signups (handle_new_user, already existed for display_name),
-- one on email changes (new — auth.users.email can change after signup,
-- e.g. a user updates it, and without this the copy would silently go stale).
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 1. Backfill existing users.
UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS DISTINCT FROM u.email;

-- 2. Seed it at signup time going forward (extends the same trigger
-- function display_name already uses).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Keep it in sync if a user's email changes after signup.
CREATE OR REPLACE FUNCTION public.handle_user_email_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.user_profiles SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_updated();
