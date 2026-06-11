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

  const body: Record<string, unknown> = {
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    contents: [{ role: "user", parts: [{ text: line }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
      continue;
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TTS ${res.status}: ${err.slice(0, 200)}`);
    }

    const json = await res.json();
    const inlineData = json.candidates?.[0]?.content?.parts?.[0]
      ?.inlineData as { mimeType: string; data: string } | undefined;

    if (!inlineData?.data) throw new Error("No audio in TTS response");

    const buf =
      inlineData.mimeType.includes("L16") || inlineData.mimeType.includes("pcm")
        ? pcmToWav(inlineData.data)
        : Buffer.from(inlineData.data, "base64");

    fs.writeFileSync(outputPath, buf);
    return;
  }

  throw new Error("TTS failed after 3 attempts");
}
