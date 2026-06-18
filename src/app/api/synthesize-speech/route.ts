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

// Maps Gemini preset voice names → closest EL voice ID (by gender/style).
const GEMINI_TO_EL: Record<string, string> = {
  Aoede:  "21m00Tcm4TlvDq8ikWAM", // Rachel  — warm feminine
  Charon: "pNInz6obpgDQGcFmaJgB", // Adam    — deep authoritative male
  Fenrir: "VR6AewLTigWG4xSOukaG", // Arnold  — strong dynamic male
  Kore:   "ThT5KcBeYPX3keUQqHPh", // Dorothy — soft gentle feminine
  Leda:   "MF3mGyEYCl7XYWbV9V6O", // Elli    — clear bright feminine
  Orus:   "GBv7mTt0atIp3Br8iCZE", // Thomas  — steady rich male
  Puck:   "SOYHLrjzK2X1ezoPC6cr", // Harry   — playful energetic
  Zephyr: "LcfcDJNUP1GQjkzn1xUU", // Emily   — airy light
};

// Default EL voice from character-name heuristics (English pattern fallback).
function getELVoiceId(assignedVoiceId: string | undefined, characterName: string): string {
  if (assignedVoiceId && GEMINI_PRESET_VOICES.has(assignedVoiceId)) {
    return GEMINI_TO_EL[assignedVoiceId] ?? "21m00Tcm4TlvDq8ikWAM";
  }
  const n = (characterName ?? "").toLowerCase();
  if (/child|kid|boy|little|young/.test(n)) return "SOYHLrjzK2X1ezoPC6cr"; // Harry
  if (/girl|fairy|sprite|elf/.test(n))      return "MF3mGyEYCl7XYWbV9V6O"; // Elli
  if (/dragon|beast|monster|giant/.test(n)) return "VR6AewLTigWG4xSOukaG"; // Arnold
  if (/elder|old|wise|king|master/.test(n)) return "GBv7mTt0atIp3Br8iCZE"; // Thomas
  if (/queen|mother|mom/.test(n))           return "LcfcDJNUP1GQjkzn1xUU"; // Emily
  return "21m00Tcm4TlvDq8ikWAM"; // Rachel — default
}

function getGeminiVoice(assignedVoiceId: string | undefined, characterName: string): string {
  if (assignedVoiceId && GEMINI_PRESET_VOICES.has(assignedVoiceId)) return assignedVoiceId;
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
  // EL needs an EL voice ID; Gemini needs a Gemini voice name.
  const voice = useEL
    ? getELVoiceId(assignedVoiceId, characterName)
    : getGeminiVoice(assignedVoiceId, characterName);

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
