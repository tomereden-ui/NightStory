import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { synthesizeLine } from "@/lib/services/ttsService";
import { PRESET_VOICES } from "@/config/presetVoices";
import { buildNamePronunciationMap, applyPronunciationOverrides } from "@/lib/services/pronunciationOverride";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
  assignedVoiceId?: string;
  language?: string;
  /** If set, check/save audio in the element store so repeat plays skip TTS */
  storyId?: string;
  /** If true, bypass element cache (e.g. after the user edited the block text) */
  forceRegenerate?: boolean;
  /** Children this text is spoken to/about — resolves confirmed pronunciation
   *  overrides (see onboarding's "Does this sound right?" flow) so their name
   *  is respelled for the TTS engine only, never in what's shown on screen. */
  childIds?: string[];
}

const PRESET_VOICE_NAMES = new Set(PRESET_VOICES.map((p) => p.geminiVoiceName));

// UUID pattern — Supabase voice row IDs, not EL voice IDs
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getGeminiVoice(assignedVoiceId: string | undefined, characterName: string): string {
  if (assignedVoiceId && PRESET_VOICE_NAMES.has(assignedVoiceId)) return assignedVoiceId;
  const n = (characterName ?? "").toLowerCase();
  if (/child|kid|boy/.test(n))  return "Puck";
  if (/girl|fairy/.test(n))     return "Kore";
  if (/dragon|beast/.test(n))   return "Fenrir";
  if (/narrator/.test(n))       return "Charon";
  return "Aoede";
}

export async function POST(req: NextRequest) {
  const elKey  = process.env.ELEVENLABS_API_KEY;
  const gemKey = process.env.GEMINI_API_KEY;

  if (!gemKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: SynthesizeRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const { text, characterName, assignedVoiceId, language = "en", storyId, forceRegenerate, childIds } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

  // The real name is what's displayed everywhere (script, chat, captions) —
  // this substitution only ever touches speakText, the copy handed to TTS.
  const namePronunciationMap = await buildNamePronunciationMap(childIds);
  const speakText = applyPronunciationOverrides(text.trim(), namePronunciationMap);

  // Resolve voice: preset names go directly to Gemini; anything else
  // (DB voice IDs like "voice-1718…-abc123", UUIDs, or raw EL IDs) is
  // looked up in the voices table first so we get the actual el_voice_id /
  // gemini_voice_name rather than accidentally passing the DB row ID to EL.
  let elVoiceId: string | undefined;
  let geminiVoiceName: string | undefined;

  let savedVoiceSettings: { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean } | undefined;

  if (assignedVoiceId && !PRESET_VOICE_NAMES.has(assignedVoiceId)) {
    // Try DB lookup first — covers voice-TIMESTAMP-RANDOM and UUID formats
    if (UUID_RE.test(assignedVoiceId) || assignedVoiceId.startsWith("voice-")) {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("voices")
          .select("el_voice_id, gemini_voice_name, voice_settings")
          .eq("id", assignedVoiceId)
          .single();
        elVoiceId = data?.el_voice_id ?? undefined;
        geminiVoiceName = data?.gemini_voice_name ?? undefined;
        // Use the preset voice_settings the user chose during setup so playback
        // sounds identical to the style preview they approved.
        savedVoiceSettings = (data?.voice_settings as typeof savedVoiceSettings) ?? undefined;
      } catch {
        // If DB lookup fails, fall through to character-name heuristics
      }
    } else if (assignedVoiceId.length >= 15 && /^[a-zA-Z0-9]+$/.test(assignedVoiceId)) {
      // Raw EL voice ID passed directly — must be 15+ chars alphanumeric (real EL IDs are ~20 chars)
      elVoiceId = assignedVoiceId;
    }
  }

  // If this is a cloned EL voice but the key is missing, fail clearly rather
  // than silently falling back to a random Gemini voice that sounds wrong.
  if (elVoiceId && !elKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured — cannot play cloned voice." }, { status: 500 });
  }

  const useEL = !!(elVoiceId && elKey);
  const voice = useEL
    ? elVoiceId!
    : (geminiVoiceName ?? getGeminiVoice(assignedVoiceId, characterName));
  const apiKey = useEL ? elKey! : gemKey;
  const ext = useEL ? "mp3" : "wav";

  const textPreview = speakText.length > 80 ? `${speakText.slice(0, 80)}…` : speakText;
  console.log(`[synthesize-speech] pronunciation = "${textPreview}" — assignedVoiceId=${assignedVoiceId} → useEL=${useEL} voice=${voice} lang=${language} savedSettings=${JSON.stringify(savedVoiceSettings ?? null)}`);

  // ── Element cache lookup (skip if forceRegenerate or no storyId) ─────────────
  // Hashing on speakText (post-override) rather than the raw text means the
  // cache naturally busts itself if a pronunciation override is added/changed
  // later — no separate invalidation needed.
  const voiceKey = `${useEL ? "el" : "gm"}:${voice}`;
  let contentHash: string | null = null;
  if (storyId && !forceRegenerate) {
    try {
      const { hashDialogue, lookupElementByHash } = await import("@/lib/elementStore");
      contentHash = hashDialogue(characterName, speakText, voiceKey);
      const cachedUrl = await lookupElementByHash(storyId, contentHash);
      if (cachedUrl) {
        console.log(`[synthesize-speech] cache HIT for story=${storyId} hash=${contentHash.slice(0, 8)}`);
        const cachedMime = cachedUrl.includes(".ogg") ? "audio/ogg" : cachedUrl.includes(".wav") ? "audio/wav" : "audio/mpeg";
        return NextResponse.json({ cachedUrl, mimeType: cachedMime, voiceName: voice });
      }
      console.log(`[synthesize-speech] cache MISS for story=${storyId} hash=${contentHash.slice(0, 8)}`);
    } catch (cacheErr) {
      console.warn("[synthesize-speech] cache lookup failed:", cacheErr);
    }
  } else if (storyId && forceRegenerate) {
    // Still compute hash so we can overwrite the old element after synthesis
    try {
      const { hashDialogue } = await import("@/lib/elementStore");
      contentHash = hashDialogue(characterName, speakText, voiceKey);
    } catch { /* non-fatal */ }
  }

  const tmpBase = path.join(os.tmpdir(), `speech-${crypto.randomUUID().slice(0, 8)}`);
  const tmpPath = `${tmpBase}.${ext}`;

  // Cleanup helper — removes all candidate extensions in case Gemini wrote to a different one
  function cleanup() {
    for (const e of ["wav", "mp3", "ogg", "bin"]) {
      try { fs.unlinkSync(`${tmpBase}.${e}`); } catch { /* ignore */ }
    }
  }

  try {
    // Interactive endpoint: fail fast rather than retrying for minutes.
    // 22 s per attempt covers long narrator blocks (short lines finish in ~6 s).
    const result = await synthesizeLine(
      speakText, voice, apiKey, tmpPath, undefined, useEL,
      savedVoiceSettings?.stability,
      savedVoiceSettings?.style,
      language,
      // maxAttempts:1 for interactive previews — fail fast on 429 rather than
      // blocking a server thread for 30 s waiting for Gemini rate-limit reset.
      useEL ? undefined : { maxAttempts: 1, perAttemptTimeoutMs: 22_000 },
      savedVoiceSettings?.similarity_boost,
      savedVoiceSettings?.use_speaker_boost,
      undefined,
      undefined,
      storyId,
    );

    // Gemini may write to a different extension (.mp3/.ogg) than requested (.wav).
    // Detect which file was actually written.
    let actualPath = tmpPath;
    let mimeType = useEL ? "audio/mpeg" : "audio/wav";
    if (!useEL) {
      const mime = (result as { mimeType?: string }).mimeType ?? "";
      if (mime.includes("mp3") || mime.includes("mpeg")) {
        actualPath = `${tmpBase}.mp3`;
        mimeType = "audio/mpeg";
      } else if (mime.includes("ogg") || mime.includes("opus")) {
        actualPath = `${tmpBase}.ogg`;
        mimeType = "audio/ogg";
      }
    }

    const audio = fs.readFileSync(actualPath);

    // ── Save to element store for future cache hits ──────────────────────────
    if (storyId && contentHash) {
      import("@/lib/elementStore").then(({ saveElementFromBuffer }) =>
        saveElementFromBuffer(storyId!, contentHash!, Buffer.from(audio), mimeType, characterName, speakText)
          .catch((e) => console.warn("[synthesize-speech] element cache save failed:", e))
      );
    }

    return NextResponse.json({ audioData: audio.toString("base64"), mimeType, voiceName: voice });
  } catch (err) {
    console.error(`[synthesize-speech] error:`, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    cleanup();
  }
}
