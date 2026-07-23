import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { synthesizeLine } from "@/lib/services/ttsService";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { PRESET_VOICES } from "@/config/presetVoices";
import { HEBREW_VOICE_POOL } from "@/config/hebrewVoices";
import { PREVIEW_LANGUAGES, PREVIEW_SAMPLE_TEXT, type PreviewLanguage } from "@/config/voicePreviewSamples";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GEMINI_PRESET_IDS = new Set(PRESET_VOICES.map((v) => v.id));
const EL_POOL_IDS = new Set(HEBREW_VOICE_POOL.map((v) => v.id));

interface ComboResult {
  voiceId: string;
  language: PreviewLanguage;
  ok: boolean;
  error?: string;
}

// Cloned family voices live in the `voices` table (category='family'), not
// in either static pool above — resolved by id -> its own el_voice_id, so
// generateOne can synthesize through ElevenLabs the same way it already does
// for the curated Hebrew pool, just with a per-family voice id instead of a
// shared one. Cached for the lifetime of one request (fetched once in POST,
// not per voiceId/language combo).
async function fetchFamilyVoiceElIds(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from("voices")
      .select("id, el_voice_id")
      .eq("category", "family")
      .not("el_voice_id", "is", null);
    if (error) {
      console.warn("[generate-voice-samples] fetchFamilyVoiceElIds failed:", error.message);
      return map;
    }
    for (const row of data ?? []) {
      if (row.el_voice_id) map.set(row.id, row.el_voice_id as string);
    }
  } catch (err) {
    console.warn("[generate-voice-samples] fetchFamilyVoiceElIds exception:", err);
  }
  return map;
}

async function generateOne(voiceId: string, language: PreviewLanguage, familyElIds: Map<string, string>, customText?: string): Promise<ComboResult> {
  const isGeminiPreset = GEMINI_PRESET_IDS.has(voiceId);
  const isElPool = EL_POOL_IDS.has(voiceId);
  const familyElVoiceId = familyElIds.get(voiceId);
  if (!isGeminiPreset && !isElPool && !familyElVoiceId) {
    return { voiceId, language, ok: false, error: "Unknown voice id" };
  }

  // A custom sentence from the Voice Manager "Regenerate Previews" panel
  // overrides the per-language canned sample for every language — the admin
  // asked for this specific sentence, not a translated equivalent of it.
  const text = customText?.trim() || PREVIEW_SAMPLE_TEXT[language];
  const requestedPath = path.join(os.tmpdir(), `voice_preview_${voiceId}_${language}_${Date.now()}.wav`);
  // synthesizeGemini/synthesizeChirp3HD may silently write to a different
  // extension than the one requested, depending on the audio format the
  // provider actually returns (see ttsService.ts) — check every variant
  // instead of assuming the exact requested path exists.
  const candidateExts = ["wav", "mp3", "ogg", "bin"];
  const pathFor = (ext: string) => requestedPath.replace(/\.wav$/, `.${ext}`);

  try {
    if (isElPool || familyElVoiceId) {
      const elKey = process.env.ELEVENLABS_API_KEY;
      if (!elKey) return { voiceId, language, ok: false, error: "ELEVENLABS_API_KEY not configured" };
      // Raw EL voice id — force straight through ElevenLabs regardless of
      // language, since both the curated pool and a cloned family voice only
      // ever play via EL. The row is cached under `voiceId` (this story's/
      // family's own id), not the el_voice_id passed to ElevenLabs itself —
      // matches how familyVoiceToVoice() shapes the Voice object everywhere
      // else, so VoicePicker's sampleMap[voice.id] lookup finds it.
      await synthesizeLine(text, familyElVoiceId ?? voiceId, elKey, requestedPath, undefined, true, undefined, undefined, language);
    } else {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return { voiceId, language, ok: false, error: "GEMINI_API_KEY not configured" };
      // Same dispatch real production uses: for "he" this auto-substitutes
      // the mapped EL voice (HE_EL_VOICE_MAP), matching what a real Hebrew
      // story would actually sound like with this preset assigned.
      await synthesizeLine(text, voiceId, geminiKey, requestedPath, undefined, false, undefined, undefined, language);
    }

    const actualPath = candidateExts.map(pathFor).find((p) => fs.existsSync(p));
    if (!actualPath) {
      return { voiceId, language, ok: false, error: "Synthesis completed but no output file was found" };
    }
    const actualExt = path.extname(actualPath).slice(1);
    const contentType = actualExt === "mp3" ? "audio/mpeg" : actualExt === "ogg" ? "audio/ogg" : actualExt === "wav" ? "audio/wav" : "application/octet-stream";

    const buf = fs.readFileSync(actualPath);
    const key = `voice-preview-samples/${voiceId}_${language}.${actualExt}`;
    const { error: uploadErr } = await supabase.storage
      .from("audio")
      .upload(key, buf, { contentType, upsert: true });
    if (uploadErr) return { voiceId, language, ok: false, error: `Upload failed: ${uploadErr.message}` };

    const audioUrl = supabase.storage.from("audio").getPublicUrl(key).data.publicUrl;
    const { error: dbErr } = await supabase
      .from("voice_preview_samples")
      .upsert({ voice_id: voiceId, language, audio_url: audioUrl }, { onConflict: "voice_id,language" });
    if (dbErr) return { voiceId, language, ok: false, error: `DB write failed: ${dbErr.message}` };

    return { voiceId, language, ok: true };
  } catch (err) {
    return { voiceId, language, ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    for (const ext of candidateExts) {
      try { fs.unlinkSync(pathFor(ext)); } catch { /* ignore */ }
    }
  }
}

export async function POST(req: NextRequest) {
  let body: { voiceId?: string; applyAll?: boolean; text?: string; engines?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const familyElIds = await fetchFamilyVoiceElIds();

  // Engine-scoped regeneration (Voice Manager "Regenerate Previews" panel):
  // restrict applyAll's voice universe to whichever engines are enabled —
  // Gemini presets if either gemini engine is in the list, EL pool voices
  // (plus every cloned family voice — both only ever play through
  // ElevenLabs) if elevenlabs is. Falls back to everything when engines
  // isn't provided, so the existing admin/page.tsx "Generate ALL" button
  // keeps working as-is.
  const scopedIds = (): string[] => {
    if (!body.engines) return [...Array.from(GEMINI_PRESET_IDS), ...Array.from(EL_POOL_IDS), ...Array.from(familyElIds.keys())];
    const ids: string[] = [];
    if (body.engines.includes("gemini25") || body.engines.includes("gemini31")) ids.push(...Array.from(GEMINI_PRESET_IDS));
    if (body.engines.includes("elevenlabs")) ids.push(...Array.from(EL_POOL_IDS), ...Array.from(familyElIds.keys()));
    return ids;
  };

  const targetVoiceIds = body.voiceId
    ? [body.voiceId]
    : body.applyAll
      ? scopedIds()
      : null;

  if (!targetVoiceIds) {
    return NextResponse.json({ error: "Provide voiceId or applyAll." }, { status: 400 });
  }

  await ensureBuckets();

  const results: ComboResult[] = [];
  for (const voiceId of targetVoiceIds) {
    for (const language of PREVIEW_LANGUAGES) {
      results.push(await generateOne(voiceId, language, familyElIds, body.text));
    }
  }

  return NextResponse.json({
    totalCombos: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
