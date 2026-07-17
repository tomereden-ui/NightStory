-- Adds an explicit synthesis priority to tts_engine_settings so an admin can
-- define which engine TTS tries FIRST, and up to two fallbacks, from the
-- Voice Manager panel — replacing the previous hardcoded chain (Gemini
-- primary, chosen by a single gemini31 on/off flag -> Hebrew-only EL /
-- Chirp3-HD in that fixed order).
--
-- 1 = default/primary engine, 2 = fallback 1, 3 = fallback 2, NULL = not
-- part of the automatic synthesis chain. Independent from `enabled`, which
-- separately controls whether an engine's voices show up in Studio's
-- manual voice picker — an engine can be enabled for manual assignment
-- without being in the automatic fallback chain, or vice versa.
ALTER TABLE public.tts_engine_settings
  ADD COLUMN IF NOT EXISTS priority integer;

-- Seed with the exact values that reproduce current hardcoded behavior, so
-- nothing changes in production until an admin actively reassigns priority
-- from the panel.
UPDATE public.tts_engine_settings SET priority = 1 WHERE engine = 'gemini25' AND priority IS NULL;
UPDATE public.tts_engine_settings SET priority = 2 WHERE engine = 'chirp3hd' AND priority IS NULL;
UPDATE public.tts_engine_settings SET priority = 3 WHERE engine = 'elevenlabs' AND priority IS NULL;
