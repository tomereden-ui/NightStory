import fs from "fs";

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

async function synthesizeEL(
  text: string,
  voiceId: string,
  apiKey: string,
  outputPath: string,
): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let res: Response;
    try {
      res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
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
      console.warn(`[TTS] EL rate limited, waiting ${wait}ms (attempt ${attempt})`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (attempt < 3 && res.status >= 500) { await sleep(attempt * 2000); continue; }
      throw new Error(`EL TTS ${res.status}: ${body.slice(0, 200)}`);
    }

    const pcm = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, pcmToWav(pcm));
    return;
  }
  throw new Error("EL TTS failed after 5 attempts");
}

// ── Gemini TTS fallback ───────────────────────────────────────────────────────

async function synthesizeGemini(
  text: string,
  voiceName: string,
  apiKey: string,
  outputPath: string,
  systemInstruction?: string,
): Promise<void> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const basePayload = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };

  const payloads: Record<string, unknown>[] = systemInstruction
    ? [{ systemInstruction: { parts: [{ text: systemInstruction }] }, ...basePayload }, basePayload]
    : [basePayload];

  let lastError = "";
  for (const body of payloads) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      let res: Response;
      try {
        res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < 5) { await sleep(attempt * 1000); continue; }
        lastError = (err as { name?: string }).name === "AbortError" ? "TTS timed out" : `TTS network error: ${String(err)}`;
        break;
      }
      clearTimeout(timer);
      if (res.status === 429) { await sleep(Math.min(30000, attempt * 3000)); continue; }
      if (res.status === 500 && attempt < 3) { await sleep(attempt * 1500); continue; }
      if (!res.ok) { lastError = `TTS ${res.status}: ${(await res.text()).slice(0, 200)}`; break; }
      const json = await res.json();
      const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType: string; data: string } | undefined;
      if (!inlineData?.data) { lastError = "No audio in TTS response"; break; }
      const buf = inlineData.mimeType.includes("L16") || inlineData.mimeType.includes("pcm")
        ? pcmToWav(Buffer.from(inlineData.data, "base64"))
        : Buffer.from(inlineData.data, "base64");
      fs.writeFileSync(outputPath, buf);
      return;
    }
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
  useElevenLabs = true,
): Promise<void> {
  const tagMatches: string[] = [];
  const tagRe = /\[([^\]]+)\]/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRe.exec(line)) !== null) tagMatches.push(tagMatch[1]);
  const spokenText = line.replace(/\[([^\]]+)\]/g, "").replace(/\s{2,}/g, " ").trim();

  if (useElevenLabs) {
    return synthesizeEL(spokenText || line, voiceId, primaryKey, outputPath);
  }

  const styleHints = tagMatches.length > 0
    ? `Deliver this line with the following emotion/style: ${tagMatches.join(", ")}.`
    : "";
  const fullInstruction = [persona, styleHints].filter(Boolean).join(" ");
  return synthesizeGemini(spokenText || line, voiceId, primaryKey, outputPath, fullInstruction || undefined);
}
