import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { synthesizeLine } from "@/lib/services/ttsService";

export interface SynthesizeRequest {
  text: string;
  characterName: string;
  assignedVoiceId?: string; // Gemini voice name (Charon, Fenrir, Kore…)
  language?: string;        // ISO 639-1 code from the UI language context
}

// Preset Gemini voice names — assignedVoiceId is always one of these.
const GEMINI_PRESET_VOICES = new Set(["Aoede", "Charon", "Fenrir", "Kore", "Leda", "Orus", "Puck", "Zephyr"]);

function resolveGeminiVoice(assignedVoiceId: string | undefined, characterName: string): string {
  if (assignedVoiceId && GEMINI_PRESET_VOICES.has(assignedVoiceId)) return assignedVoiceId;
  const n = (characterName ?? "").toLowerCase();
  if (n === "narrator") return "Charon";
  if (/child|kid|boy/.test(n)) return "Puck";
  if (/girl|fairy/.test(n)) return "Kore";
  if (/dragon|beast|monster/.test(n)) return "Fenrir";
  return "Aoede";
}

export async function POST(req: NextRequest) {
  const elKey  = process.env.ELEVENLABS_API_KEY;
  const gemKey = process.env.GEMINI_API_KEY;

  if (!elKey && !gemKey) {
    return NextResponse.json({ error: "No TTS provider configured." }, { status: 500 });
  }

  let body: SynthesizeRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const { text, characterName, assignedVoiceId, language = "en" } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

  const useEL = !!elKey;
  const apiKey = useEL ? elKey : gemKey!;
  const voice = resolveGeminiVoice(assignedVoiceId, characterName);

  // Write to a temp file using the same synthesizeLine() path as the test tab,
  // then read the bytes back and return them as base64.
  const tmpPath = path.join(os.tmpdir(), `speech-${crypto.randomUUID().slice(0, 8)}.wav`);
  try {
    await synthesizeLine(text, voice, apiKey, tmpPath, undefined, useEL, undefined, undefined, language);
    const wav = fs.readFileSync(tmpPath);
    return NextResponse.json({ audioData: wav.toString("base64"), mimeType: "audio/wav", voiceName: voice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
