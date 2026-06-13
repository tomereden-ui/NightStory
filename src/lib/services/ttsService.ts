import fs from "fs";

function pcmToWav(pcmBase64: string): Buffer {
  const pcm = Buffer.from(pcmBase64, "base64");
  const sampleRate = 24000;
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

export async function synthesizeLine(
  line: string,
  voiceName: string,
  apiKey: string,
  outputPath: string,
  systemInstruction?: string,
): Promise<void> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const basePayload = {
    contents: [{ role: "user", parts: [{ text: line }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };

  // Try with systemInstruction first; fall back to without it if the model rejects it
  const payloads: Record<string, unknown>[] = systemInstruction
    ? [
        { systemInstruction: { parts: [{ text: systemInstruction }] }, ...basePayload },
        basePayload,
      ]
    : [basePayload];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let lastError = "";
  for (const body of payloads) {
    // Up to 5 attempts per payload with backoff for rate limits
    for (let attempt = 1; attempt <= 5; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const isTimeout = (err as { name?: string }).name === "AbortError";
        if (attempt < 5) { await sleep(attempt * 1000); continue; }
        lastError = isTimeout ? "TTS timed out" : `TTS network error: ${String(err)}`;
        break;
      }
      clearTimeout(timer);

      // Rate limited — wait and retry same payload
      if (res.status === 429) {
        const wait = Math.min(30000, attempt * 3000);
        console.warn(`[TTS] Rate limited, waiting ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        continue;
      }

      // Transient server error — retry with short backoff
      if (res.status === 500 && attempt < 3) {
        await sleep(attempt * 1500);
        continue;
      }

      // Other API error — try next payload (e.g. without systemInstruction)
      if (!res.ok) {
        lastError = `TTS ${res.status}: ${(await res.text()).slice(0, 200)}`;
        break;
      }

      const json = await res.json();
      const inlineData = json.candidates?.[0]?.content?.parts?.[0]
        ?.inlineData as { mimeType: string; data: string } | undefined;

      if (!inlineData?.data) {
        lastError = "No audio in TTS response";
        break;
      }

      const buf =
        inlineData.mimeType.includes("L16") || inlineData.mimeType.includes("pcm")
          ? pcmToWav(inlineData.data)
          : Buffer.from(inlineData.data, "base64");

      fs.writeFileSync(outputPath, buf);
      return;
    }
  }

  throw new Error(lastError || "TTS failed");
}
