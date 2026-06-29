-- Add voice_settings column to store selected EL preset parameters
ALTER TABLE public.voices
  ADD COLUMN IF NOT EXISTS voice_settings jsonb,
  ADD COLUMN IF NOT EXISTS preset_key text;
