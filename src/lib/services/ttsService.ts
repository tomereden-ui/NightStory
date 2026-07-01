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

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────────────────────────

// Detect script/language from text content for EL language_code hint
function detectLanguageCode(text: string, hint?: string): string | undefined {
  if (/[֐-׿יִ-ﮯ]/.test(text)) return "he";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[一-鿿　-ヿ]/.test(text)) return hint === "ja" ? "ja" : "zh";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (hint && hint !== "en") return hint;
  return undefined;
}

async function synthesizeEL(
  text: string,
  voiceId: string,
  apiKey: string,
  outputPath: string,
  stability = 0.35,
  style = 0.35,
  language?: string,
  similarityBoost = 0.80,
  useSpeakerBoost = true,
  speed?: number,
): Promise<void> {
  const langCode = detectLanguageCode(text, language);
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
            model_id: "eleven_v3",
            ...(langCode ? { language_code: langCode } : {}),
            ...(speed !== undefined ? { speed } : {}),
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

// ── Google Cloud Chirp 3 HD ───────────────────────────────────────────────────────────────────────

// ISO 639-1 → BCP-47 locale for Chirp 3 HD
const LANG_TO_LOCALE: Record<string, string> = {
  en: "en-US", he: "he-IL", ar: "ar-XA", fr: "fr-FR", de: "de-DE",
  es: "es-ES", it: "it-IT", pt: "pt-BR", ru: "ru-RU", zh: "cmn-CN",
  ja: "ja-JP", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR",
  hi: "hi-IN", sv: "sv-SE", da: "da-DK", fi: "fi-FI", no: "nb-NO",
};

// Chirp 3 HD voice names — same as Gemini TTS prebuilt voices
const CHIRP3_VOICES = new Set([
  "Aoede", "Puck", "Kore", "Charon", "Fenrir", "Leda", "Orus", "Zephyr", "Autonoe",
]);

async function synthesizeChirp3HD(
  text: string,
  voiceName: string,
  apiKey: string,
  outputPath: string,
  language = "en",
  opts?: { maxAttempts?: number; perAttemptTimeoutMs?: number },
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const timeoutMs   = opts?.perAttemptTimeoutMs ?? 25_000;
  const locale = LANG_TO_LOCALE[language] ?? "en-US";
  // Fall back to Aoede if the voice isn't in Chirp 3 HD's set
  const chirpVoice = CHIRP3_VOICES.has(voiceName) ? voiceName : "Aoede";
  const fullVoiceName = `${locale}-Chirp3-HD-${chirpVoice}`;
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  console.log(`[${ts()}][Chirp3HD] voice=${fullVoiceName} lang=${locale}`);

  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: locale, name: fullVoiceName },
          audioConfig: { audioEncoding: "MP3" },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxAttempts) { await sleep(attempt * 1000); continue; }
      throw new Error((err as { name?: string }).name === "AbortError" ? "Chirp3HD TTS timed out" : `Chirp3HD network error: ${String(err)}`);
    }
    clearTimeout(timer);

    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      console.warn(`[${ts()}][Chirp3HD] 429 rate limited (attempt ${attempt}/${maxAttempts}): ${body.slice(0, 200)}`);
      lastError = `Chirp3HD rate limited (429): ${body.slice(0, 200)}`;
      if (attempt < maxAttempts) { await sleep(attempt * 5000); continue; }
      break;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      lastError = `Chirp3HD ${res.status}: ${body.slice(0, 300)}`;
      console.error(`[${ts()}][Chirp3HD] HTTP ${res.status}:`, body.slice(0, 400));
      if (res.status >= 500 && attempt < maxAttempts) { await sleep(attempt * 1500); continue; }
      break;
    }

    const json = await res.json() as { audioContent?: string };
    if (!json.audioContent) {
      lastError = "Chirp3HD returned no audio";
      if (attempt < maxAttempts) { await sleep(attempt * 2000); continue; }
      break;
    }

    const mp3 = Buffer.from(json.audioContent, "base64");
    console.log(`[${ts()}][Chirp3HD] received ${mp3.length} bytes`);
    fs.writeFileSync(outputPath.replace(/\.wav$/i, ".mp3"), mp3);
    return;
  }
  throw new Error(lastError || "Chirp3HD TTS failed");
}

// ── Gemini TTS (kept as fallback — inactive when GOOGLE_CLOUD_TTS_KEY is set) ───────────────────

// ISO 639-1 → readable name for Gemini system instruction
const LANG_NAMES: Record<string, string> = {
  en: "English", he: "Hebrew", ar: "Arabic", fr: "French", es: "Spanish",
  de: "German", it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese",
  ja: "Japanese", ko: "Korean", nl: "Dutch", pl: "Polish", tr: "Turkish",
  hi: "Hindi", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian",
};

// ── Gemini TTS ────────────────────────────────────────────────────────────────────────────────────

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
      const body429 = await res.text().catch(() => "");
      // Log headers that reveal the real reason (quota vs. model overload vs. burst)
      const hdrs: Record<string, string> = {};
      res.headers.forEach((v, k) => { hdrs[k] = v; });
      console.warn(
        `[${ts()}][TTS] 429 from Gemini (attempt ${attempt}/${maxAttempts})\n` +
        `  headers: ${JSON.stringify(hdrs)}\n` +
        `  body:    ${body429.slice(0, 600)}`,
      );
      lastError = `TTS rate limited (429): ${body429.slice(0, 200)}`;
      const wait429 = Math.min(30_000, attempt * 10_000);
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
      const header = rawBuf.slice(0, 4).toString("ascii");
      console.warn(`[${ts()}][Gemini TTS] Unknown mime "${mime}", header bytes: ${JSON.stringify(header)}`);
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

// ── Public API ────────────────────────────────────────────────────────────────────────────────

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
  speed?: number,
): Promise<{ mimeType?: string }> {
  // Strip performance tags [warmly] etc. for providers that don't interpret them
  const spokenText = line.replace(/\[([^\]]+)\]/g, "").replace(/\s{2,}/g, " ").trim();

  if (useElevenLabs) {
    console.log(`[${ts()}][EL TTS] text →`, JSON.stringify(spokenText || line));
    await synthesizeEL(spokenText || line, voiceId, primaryKey, outputPath, stability, style, language, similarityBoost, useSpeakerBoost, speed);
    return {};
  }

  // Chirp 3 HD — active when GOOGLE_CLOUD_TTS_KEY is set in env
  const gcTtsKey = process.env.GOOGLE_CLOUD_TTS_KEY;
  if (gcTtsKey) {
    console.log(`[${ts()}][Chirp3HD] text →`, JSON.stringify(spokenText || line));
    await synthesizeChirp3HD(spokenText || line, voiceId, gcTtsKey, outputPath, language ?? "en", geminiOpts);
    return { mimeType: "audio/mpeg" };
  }

  // Gemini TTS fallback — used when GOOGLE_CLOUD_TTS_KEY is not set
  console.log(`[${ts()}][Gemini TTS] text →`, JSON.stringify(line));
  return synthesizeGemini(line, voiceId, primaryKey, outputPath, persona || undefined, language, geminiOpts);
}
