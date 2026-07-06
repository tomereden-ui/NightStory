import fs from "fs";
import { trackELTts, trackGeminiTts } from "@/lib/usageTracker";

const ts = () => new Date().toTimeString().slice(0, 8);

export function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
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

// ── Google Cloud TTS (Chirp 3 HD + WaveNet fallback for unsupported locales) ─────────────────────

// ISO 639-1 → BCP-47 locale
const LANG_TO_LOCALE: Record<string, string> = {
  en: "en-US", he: "he-IL", ar: "ar-XA", fr: "fr-FR", de: "de-DE",
  es: "es-ES", it: "it-IT", pt: "pt-BR", ru: "ru-RU", zh: "cmn-CN",
  ja: "ja-JP", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR",
  hi: "hi-IN", sv: "sv-SE", da: "da-DK", fi: "fi-FI", no: "nb-NO",
};

// Preset voice id → real Google Cloud Chirp3-HD voice name for en-US.
// Verified live against the Chirp3-HD voices Google actually offers for
// en-US (GET https://texttospeech.googleapis.com/v1/voices?languageCode=en-US) —
// most preset ids already match a real Chirp3-HD name 1:1. "Isonoe" and
// "Altair" don't exist under those names in Google's catalog, so they're
// aliased to real, otherwise-unused Chirp3-HD voices matching their
// intended gender (Isonoe: female/gentle → Pulcherrima; Altair: male/calm →
// Iapetus) instead of silently collapsing to Aoede.
const CHIRP3_VOICE_MAP: Record<string, string> = {
  Aoede: "Aoede", Puck: "Puck", Kore: "Kore", Charon: "Charon", Fenrir: "Fenrir",
  Leda: "Leda", Orus: "Orus", Zephyr: "Zephyr", Autonoe: "Autonoe",
  Callirrhoe: "Callirrhoe", Despina: "Despina", Erinome: "Erinome", Gacrux: "Gacrux",
  Laomedeia: "Laomedeia", Rasalgethi: "Rasalgethi", Sadachbia: "Sadachbia",
  Sadaltager: "Sadaltager", Schedar: "Schedar", Sulafat: "Sulafat", Umbriel: "Umbriel",
  Vindemiatrix: "Vindemiatrix", Zubenelgenubi: "Zubenelgenubi",
  Isonoe: "Pulcherrima",
  Altair: "Iapetus",
};

// Locales where Chirp 3 HD quality is poor — route to WaveNet instead.
// Each entry maps Chirp voice name → { voice, pitch } so all 4 WaveNet
// voices + SSML pitch offsets give 9 perceptually distinct characters.
const WAVENET_VOICE_MAP: Record<string, Record<string, { voice: string; pitch?: string }>> = {
  "he-IL": {
    // Females — A and C, each used at two pitch levels
    Aoede:   { voice: "he-IL-Wavenet-A" },             // warm narrator/lead female
    Kore:    { voice: "he-IL-Wavenet-C" },             // brighter female
    Leda:    { voice: "he-IL-Wavenet-A", pitch: "+2st" }, // lighter female
    Autonoe: { voice: "he-IL-Wavenet-C", pitch: "-2st" }, // deeper/older female
    // Males — B and D, each used at two pitch levels
    Charon:  { voice: "he-IL-Wavenet-B" },             // narrator/deep male
    Fenrir:  { voice: "he-IL-Wavenet-D" },             // gruff/beast male
    Puck:    { voice: "he-IL-Wavenet-B", pitch: "+3st" }, // child/young male
    Orus:    { voice: "he-IL-Wavenet-D", pitch: "+2st" }, // lighter adult male
    Zephyr:  { voice: "he-IL-Wavenet-B", pitch: "-2st" }, // older/authority male
  },
};

function resolveGCVoiceName(locale: string, presetVoiceId: string): { name: string; pitchOverride?: string } {
  const localeMap = WAVENET_VOICE_MAP[locale];
  if (localeMap) {
    const entry = localeMap[presetVoiceId] ?? localeMap["Aoede"] ?? { voice: `${locale}-Wavenet-A` };
    return { name: entry.voice, pitchOverride: entry.pitch };
  }
  const chirpVoice = CHIRP3_VOICE_MAP[presetVoiceId] ?? "Aoede";
  return { name: `${locale}-Chirp3-HD-${chirpVoice}` };
}

function escapeXML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Convert a script line with [performance tag] prefix into SSML.
// basePitch is added when a voice map entry has a pitch offset (e.g. "+2st" for Puck).
function lineToSSML(line: string, basePitch?: string): string {
  const tagMatch = line.match(/^\[([^\]]+)\]\s*/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : "";
  const spoken = line
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\[SFX:[^\]]*\]/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!spoken) return "";

  const body = escapeXML(spoken);

  // Map performance tag keywords → prosody attrs (pitch here is relative to basePitch)
  let rate = "";
  let pitchDelta = 0;
  let volume = "";

  if (/whisper/i.test(tag))                            { volume = "x-soft"; rate = "slow"; }
  else if (/excited|energetic|enthusiastic/i.test(tag)){ rate = "fast";  pitchDelta = +2; }
  else if (/sleep|drowsy|tired|yawn/i.test(tag))       { rate = "slow";  pitchDelta = -2; volume = "soft"; }
  else if (/gentle|softly|soft|tenderly/i.test(tag))   { volume = "soft"; rate = "slow"; }
  else if (/nervous|anxious|tremble/i.test(tag))       { rate = "fast";  pitchDelta = +1; }
  else if (/wonder|awe|amazed|wide.eyed/i.test(tag))   { rate = "slow";  pitchDelta = +2; }
  else if (/scar|fear|panic/i.test(tag))               { rate = "fast";  pitchDelta = +1; volume = "soft"; }
  else if (/proud|confident|triumphant/i.test(tag))    { pitchDelta = +1; }
  else if (/warm|kind|loving|affection/i.test(tag))    { pitchDelta = +1; rate = "medium"; }
  else if (/sad|crying|sob|teary/i.test(tag))          { rate = "slow";  pitchDelta = -2; volume = "soft"; }
  else if (/dramatic|serious|solemn/i.test(tag))       { rate = "slow";  pitchDelta = -2; }
  else if (/giggle|laugh/i.test(tag))                  { rate = "fast";  pitchDelta = +3; }
  else if (/brave|heroic|bold/i.test(tag))             { pitchDelta = -1; rate = "medium"; }
  else if (/mysterious|hushed/i.test(tag))             { volume = "soft"; rate = "slow"; pitchDelta = -1; }
  else if (/angry|frustrated/i.test(tag))              { rate = "fast";  pitchDelta = -1; volume = "loud"; }

  // Combine basePitch offset + tag-driven delta into a single pitch attr
  const baseSt = basePitch ? parseInt(basePitch) : 0;
  const totalSt = baseSt + pitchDelta;
  const pitchAttr = totalSt !== 0 ? `pitch="${totalSt > 0 ? "+" : ""}${totalSt}st"` : "";

  const parts = [rate ? `rate="${rate}"` : "", pitchAttr, volume ? `volume="${volume}"` : ""].filter(Boolean).join(" ");

  if (parts) return `<speak><prosody ${parts}>${body}</prosody></speak>`;
  return `<speak>${body}</speak>`;
}

async function synthesizeChirp3HD(
  line: string,
  voiceName: string,
  apiKey: string,
  outputPath: string,
  language = "en",
  opts?: { maxAttempts?: number; perAttemptTimeoutMs?: number },
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const timeoutMs   = opts?.perAttemptTimeoutMs ?? 25_000;
  const locale = LANG_TO_LOCALE[language] ?? "en-US";
  const { name: fullVoiceName, pitchOverride } = resolveGCVoiceName(locale, voiceName);
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const ssml = lineToSSML(line, pitchOverride);
  const input = ssml ? { ssml } : { text: line };

  const model = WAVENET_VOICE_MAP[locale] ? "WaveNet" : "Chirp3-HD";
  console.log(`[${ts()}][GC-TTS/${model}] voice=${fullVoiceName} pitch=${pitchOverride ?? "0"} lang=${locale} ssml=${!!ssml}`);

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
          input,
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
  // gemini-3.1-flash-tts-preview was blocked/erroring when tested via Voice
  // Manager. gemini-2.5-flash-preview-tts is the model actually working today
  // (voices/preview/route.ts, seed-bluebell-audio/route.ts) -- same request
  // shape, different model id. Now this app's primary TTS engine for all
  // languages, so it needs to be the reliable one.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

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

// ── Hebrew EL preset voice map ────────────────────────────────────────────────────────────────
// WaveNet can't handle Hebrew pronunciation — EL eleven_v3 does.
// Maps Gemini/Chirp voice names → EL preset voice IDs by character archetype.
// These must be voice ids this account actually owns (GET /v1/voices) — the
// original set used ElevenLabs' legacy premade voice ids, which have since
// gone stale (silently resolve to unrelated voices; three of the original
// nine had collapsed onto the same underlying voice). Replaced 2026-07-03.
const HE_EL_VOICE_MAP: Record<string, string> = {
  Aoede:         "EXAVITQu4vr4xnSDxMaL", // Sarah    — warm reassuring female
  Kore:          "cgSgspJ2msm6clMCkdW9", // Jessica  — playful bright female
  Leda:          "Xb7hH8MSUJpSbSDYk0k2", // Alice    — clear calm female
  Autonoe:       "XrExE9yKIg1WjnnlVkGX", // Matilda  — knowledgeable dramatic female
  Charon:        "JBFqnCBsd6RMkjVDRZzb", // George   — warm storyteller male
  Fenrir:        "IKne3meq5aSn9XLyUdCD", // Charlie  — deep dramatic male
  Puck:          "TX3LPaxmHKxFdv7VOQHJ", // Liam     — energetic playful male
  Orus:          "pqHfZKP75CvOlQylNhV4", // Bill     — wise calm male
  Zephyr:        "nPczCjzI2devNBz1zQrb", // Brian    — deep gentle male
};

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

  // Auto-detect language from text content — UI language hint may be wrong
  // (e.g. app UI in English while story text is Hebrew)
  const detectedLang = detectLanguageCode(spokenText || line, language ?? undefined);
  const effectiveLang = detectedLang ?? language ?? "en";

  if (useElevenLabs) {
    console.log(`[${ts()}][EL TTS] text →`, JSON.stringify(spokenText || line));
    // Hebrew prosody tuning: lower stability + higher style push the voice away
    // from a flat/robotic delivery. Applied only when the caller didn't already
    // supply settings (e.g. a raw EL voice id assigned to a Hebrew character).
    const heTuned = effectiveLang === "he";
    await synthesizeEL(
      spokenText || line, voiceId, primaryKey, outputPath,
      stability ?? (heTuned ? 0.30 : undefined),
      style ?? (heTuned ? 0.60 : undefined),
      effectiveLang,
      similarityBoost ?? (heTuned ? 0.75 : undefined),
      useSpeakerBoost,
      speed,
    );
    return {};
  }

  // Gemini 2.5 Flash TTS is now the primary engine for every language —
  // confirmed Hebrew-capable per Google's own docs (no per-voice restriction),
  // and this is the same model already verified reliable via Voice Manager.
  try {
    console.log(`[${ts()}][Gemini TTS] text →`, JSON.stringify(line));
    return await synthesizeGemini(line, voiceId, primaryKey, outputPath, persona || undefined, language, geminiOpts);
  } catch (primaryErr) {
    console.warn(`[${ts()}][Gemini TTS] Primary engine failed, falling back:`, primaryErr);
  }

  // Fallback 1 — Hebrew: ElevenLabs' curated pool, hand-verified for Hebrew pronunciation
  if (effectiveLang === "he") {
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (elKey) {
      const heVoiceId = HE_EL_VOICE_MAP[voiceId] ?? HE_EL_VOICE_MAP["Charon"]!;
      console.log(`[${ts()}][HE-EL fallback] ${voiceId} → ${heVoiceId}`);
      // Hebrew prosody tuning: lower stability allows natural intonation variance;
      // higher style exaggeration pushes the voice away from flat/robotic delivery.
      await synthesizeEL(spokenText || line, heVoiceId, elKey, outputPath, stability ?? 0.30, style ?? 0.60, "he", similarityBoost ?? 0.75, useSpeakerBoost ?? true, speed);
      return { mimeType: "audio/mpeg" };
    }
    console.warn(`[${ts()}][HE] ELEVENLABS_API_KEY not set — using WaveNet fallback for Hebrew`);
  }

  // Fallback 2 — Google Cloud Chirp3-HD, if configured
  const gcTtsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (gcTtsKey) {
    // Pass raw line — synthesizeChirp3HD converts [tags] to SSML internally
    await synthesizeChirp3HD(line, voiceId, gcTtsKey, outputPath, effectiveLang, geminiOpts);
    return { mimeType: "audio/mpeg" };
  }

  throw new Error("Gemini TTS failed and no fallback provider (ElevenLabs/Google Cloud TTS) is configured.");
}
