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

  if (assignedVoiceId && !PRESET_VOICE_NAMES.has(assignedVoiceId)) {
    // Try DB lookup first — covers voice-TIMESTAMP-RANDOM and UUID formats
    if (UUID_RE.test(assignedVoiceId) || assignedVoiceId.startsWith("voice-")) {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("voices")
          .select("el_voice_id, gemini_voice_name")
          .eq("id", assignedVoiceId)
          .single();
        elVoiceId = data?.el_voice_id ?? undefined;
        geminiVoiceName = data?.gemini_voice_name ?? undefined;
      } catch {
        // If DB lookup fails, fall through to character-name heuristics
      }
    } else if (/[0-9]/.test(assignedVoiceId)) {
      // Raw EL voice ID passed directly (alphanumeric, no hyphens/prefix)
      elVoiceId = assignedVoiceId;
    }
  }

  const useEL = !!(elVoiceId && elKey);
  const voice = useEL
    ? elVoiceId!
    : (geminiVoiceName ?? getGeminiVoice(assignedVoiceId, characterName));
  const apiKey = useEL ? elKey! : gemKey;
  const ext = useEL ? "mp3" : "wav";

  const tmpPath = path.join(os.tmpdir(), `speech-${crypto.randomUUID().slice(0, 8)}.${ext}`);
  try {
    // Interactive endpoint: fail fast rather than retrying for minutes
    await synthesizeLine(text, voice, apiKey, tmpPath, undefined, useEL, undefined, undefined, language,
      useEL ? undefined : { maxAttempts: 2, perAttemptTimeoutMs: 10_000 });
    const audio = fs.readFileSync(tmpPath);
    const mimeType = useEL ? "audio/mpeg" : "audio/wav";
    return NextResponse.json({ audioData: audio.toString("base64"), mimeType, voiceName: voice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
