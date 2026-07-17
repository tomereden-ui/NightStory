-- Add pronunciation_override to child_profiles — an optional TTS-only
-- respelling of the child's name, confirmed by the parent during onboarding
-- ("Does this sound right?" -> alternatives -> pick the closest one). The
-- real name is always what's shown in the script/UI; when a story's audio
-- is produced, this text is substituted in ONLY for the text actually sent
-- to TTS, wherever the child's real name appears in dialogue/narration.
ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS pronunciation_override text;
