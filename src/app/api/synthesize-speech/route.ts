import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { synthesizeLine } from "@/lib/services/ttsService";
import { PRESET_VOICES } from "@/config/presetVoices";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
  assignedVoiceId?: string;
  language?: string;
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

  const { text, characterName, assignedVoiceId, language = "en" } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

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
    } else if (/[0-9]/.test(assignedVoiceId)) {
      // Raw EL voice ID passed directly (alphanumeric, no hyphens/prefix)
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

  console.log(`[synthesize-speech] assignedVoiceId=${assignedVoiceId} → useEL=${useEL} voice=${voice} lang=${language} savedSettings=${JSON.stringify(savedVoiceSettings ?? null)}`);

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
      text, voice, apiKey, tmpPath, undefined, useEL,
      savedVoiceSettings?.stability,
      savedVoiceSettings?.style,
      language,
      useEL ? undefined : { maxAttempts: 2, perAttemptTimeoutMs: 22_000 },
      savedVoiceSettings?.similarity_boost,
      savedVoiceSettings?.use_speaker_boost,
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
    return NextResponse.json({ audioData: audio.toString("base64"), mimeType, voiceName: voice });
  } catch (err) {
    console.error(`[synthesize-speech] error:`, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    cleanup();
  }
}
