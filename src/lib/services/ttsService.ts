import fs from "fs";
import { trackELTts, trackGeminiTts } from "@/lib/usageTracker";

const ts = () => new Date().toTimeString().slice(0, 8);

function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLen = pcm.length;
  const wav = Buffer.alloc(44 + dataLen);
  let o = 0;
  wav.write("RIFF", o); o += 4;
  wav.writeUInt32LE(36 + dataLen, o); o += 4;
  wav.write("WAVE", o); o += 4;
  wav.write("fmt ", o); o += 4;
  wav.writeUInt32LE(16, o); o += 4;
  wav.writeUInt16LE(1, o); o += 2;
  wav.writeUInt16LE(numChannels, o); o += 2;
  wav.writeUInt32LE(sampleRate, o); o += 4;
  wav.writeUInt32LE(byteRate, o); o += 4;
  wav.writeUInt16LE(blockAlign, o); o += 2;
  wav.writeUInt16LE(bitsPerSample, o); o += 2;
  wav.write("data", o); o += 4;
  wav.writeUInt32LE(dataLen, o); o += 4;
  pcm.copy(wav, o);
  return wav;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────

// Detect script/language from text content for EL language_code hint
function detectLanguageCode(text: string, hint?: string): string | undefined {
  if (/[֐-׿יִ-ﭏ]/.test(text)) return "he";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[一-鿿぀-ヿ]/.test(text)) return hint === "ja" ? "ja" : "zh";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (hint && hint !== "en") return hint;
  return undefined;
}

async function synthesizeEL(
  text: string,
  voiceId: string,
  apiKey: string,
  outputPath: string,
  stability = 0.5,
  style = 0.0,
  language?: string,
  similarityBoost = 0.75,
  useSpeakerBoost = true,
): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let res: Response;
    try {
      res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability, similarity_boost: similarityBoost, style, use_speaker_boost: useSpeakerBoost },
          }),
          signal: controller.signal,
        },
      );
    } catch (err) {
      clearTimeout(timer);
      if (attempt < 5) { await sleep(attempt * 1000); continue; }
      throw new Error((err as { name?: string }).name === "AbortError" ? "EL TTS timed out" : `EL TTS network error: ${String(err)}`);
    }
    clearTimeout(timer);

    if (res.status === 429) {
      const wait = Math.min(30_000, attempt * 5000);
      console.warn(`[${ts()}][TTS] EL rate limited, waiting ${wait}ms (attempt ${attempt})`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (attempt < 3 && res.status >= 500) { await sleep(attempt * 2000); continue; }
      throw new Error(`EL TTS ${res.status}: ${body.slice(0, 200)}`);
    }

    // Check content-type — if EL returned JSON (e.g. an error body with 200 status), reject it
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.text().catch(() => "");
      throw new Error(`EL TTS returned JSON instead of audio: ${body.slice(0, 200)}`);
    }

    const mp3 = Buffer.from(await res.arrayBuffer());
    console.log(`[${ts()}][EL TTS] received ${mp3.length} bytes, content-type: ${contentType}`);
    if (mp3.length < 1000) {
      console.warn(`[${ts()}][EL TTS] suspiciously small audio (${mp3.length} bytes) — first bytes: ${mp3.slice(0, 16).toString("hex")}`);
    }
    fs.writeFileSync(outputPath.replace(/\.wav$/, ".mp3"), mp3);
    trackELTts(text.length).catch(() => {});
    return;
  }
  throw new Error("EL TTS failed after 5 attempts");
}

// ISO 639-1 → readable name for Gemini system instruction
const LANG_NAMES: Record<string, string> = {
  en: "English", he: "Hebrew", ar: "Arabic", fr: "French", es: "Spanish",
  de: "German", it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese",
  ja: "Japanese", ko: "Korean", nl: "Dutch", pl: "Polish", tr: "Turkish",
  hi: "Hindi", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian",
};

// ── Gemini TTS fallback ───────────────────────────────────────────────────────

interface GeminiTTSOptions {
  maxAttempts?: number;       // per payload; default 5
  perAttemptTimeoutMs?: number; // default 25_000
}

async function synthesizeGemini(
  text: string,
  voiceName: string,
  apiKey: string,
  outputPath: string,
  systemInstruction?: string,
  language?: string,
  opts?: GeminiTTSOptions,
): Promise<{ mimeType: string }> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const timeoutMs   = opts?.perAttemptTimeoutMs ?? 25_000;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`;

  // Gemini 3.1 Flash TTS does NOT support systemInstruction.
  // Expressiveness comes from inline [audio tags] already in the line text.
  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };

  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxAttempts) { await sleep(attempt * 1000); continue; }
      lastError = (err as { name?: string }).name === "AbortError" ? "TTS timed out" : `TTS network error: ${String(err)}`;
      break;
    }
    clearTimeout(timer);
    if (res.status === 429) {
      await res.text().catch(() => "");
      lastError = "TTS rate limited (429)";
      const wait429 = Math.min(30_000, attempt * 10_000);
      console.warn(`[${ts()}][TTS] 429 from Gemini (attempt ${attempt}/${maxAttempts}), waiting ${wait429}ms`);
      if (attempt < maxAttempts) { await sleep(wait429); continue; }
      break;
    }
    if (res.status === 500 && attempt < Math.min(3, maxAttempts)) { await sleep(attempt * 1500); continue; }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      lastError = `TTS ${res.status}: ${errBody.slice(0, 300)}`;
      console.error(`[${ts()}][Gemini TTS] HTTP ${res.status}:`, errBody.slice(0, 500));
      break;
    }
    const json = await res.json();
    const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType: string; data: string } | undefined;
    if (!inlineData?.data) {
      lastError = "No audio in TTS response";
      console.warn(`[${ts()}][Gemini TTS] No audio — full response:`, JSON.stringify(json).slice(0, 500));
      if (attempt < Math.min(3, maxAttempts)) { await sleep(attempt * 2000); continue; }
      break;
    }
    const mime = inlineData.mimeType ?? "";
    const rawBuf = Buffer.from(inlineData.data, "base64");
    console.log(`[${ts()}][Gemini TTS] mimeType: ${mime}, bytes: ${rawBuf.length}`);

    const lmime = mime.toLowerCase();
    const isPcm  = lmime.includes("l16") || lmime.includes("pcm");
    const isMp3  = lmime.includes("mp3") || lmime.includes("mpeg");
    const isOgg  = lmime.includes("ogg") || lmime.includes("opus");
    const isWav  = lmime.includes("wav");

    if (isPcm) {
      // Parse sample rate from mime like "audio/L16;rate=24000"
      const rateMatch = mime.match(/rate=(\d+)/i);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      fs.writeFileSync(outputPath, pcmToWav(rawBuf, sampleRate));
    } else if (isMp3) {
      fs.writeFileSync(outputPath.replace(/\.wav$/i, ".mp3"), rawBuf);
    } else if (isOgg) {
      fs.writeFileSync(outputPath.replace(/\.wav$/i, ".ogg"), rawBuf);
    } else if (isWav) {
      fs.writeFileSync(outputPath, rawBuf);
    } else {
      // Unknown — log first bytes to diagnose, write with detected extension
      const header = rawBuf.slice(0, 4).toString("ascii");
      console.warn(`[${ts()}][Gemini TTS] Unknown mime "${mime}", header bytes: ${JSON.stringify(header)}`);
      // Try to auto-detect by magic bytes
      const isOggMagic = rawBuf[0] === 0x4f && rawBuf[1] === 0x67 && rawBuf[2] === 0x67;
      const isMp3Magic = rawBuf[0] === 0xff && (rawBuf[1] & 0xe0) === 0xe0;
      const isWavMagic = header === "RIFF";
      if (isOggMagic) fs.writeFileSync(outputPath.replace(/\.wav$/i, ".ogg"), rawBuf);
      else if (isMp3Magic) fs.writeFileSync(outputPath.replace(/\.wav$/i, ".mp3"), rawBuf);
      else if (isWavMagic) fs.writeFileSync(outputPath, rawBuf);
      else fs.writeFileSync(outputPath.replace(/\.wav$/i, ".bin"), rawBuf);
    }
    trackGeminiTts(text.length).catch(() => {});
    return { mimeType: mime };
  }
  throw new Error(lastError || "Gemini TTS failed");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function synthesizeLine(
  line: string,
  voiceId: string,
  primaryKey: string,
  outputPath: string,
  persona?: string,
  useElevenLabs = false,
  stability?: number,
  style?: number,
  language?: string,
  geminiOpts?: GeminiTTSOptions,
  similarityBoost?: number,
  useSpeakerBoost?: boolean,
): Promise<{ mimeType?: string }> {
  const spokenText = line.replace(/\[([^\]]+)\]/g, "").replace(/\s{2,}/g, " ").trim();

  if (useElevenLabs) {
    console.log(`[${ts()}][EL TTS] text →`, JSON.stringify(spokenText || line));
    await synthesizeEL(spokenText || line, voiceId, primaryKey, outputPath, stability, style, language, similarityBoost, useSpeakerBoost);
    return {};
  }

  console.log(`[${ts()}][Gemini TTS] text →`, JSON.stringify(line));
  return synthesizeGemini(line, voiceId, primaryKey, outputPath, persona || undefined, language, geminiOpts);
}
