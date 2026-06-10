import fs from "fs";

/**
 * Calls ElevenLabs sound-generation API.
 * Returns true on success, false on failure (caller should use silence fallback).
 */
export async function generateSfx(
  description: string,
  durationHintMs: number,
  apiKey: string,
  outputPath: string,
): Promise<boolean> {
  const durationSeconds = Math.min(22, Math.max(0.5, durationHintMs / 1000));

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: description,
        duration_seconds: durationSeconds,
        prompt_influence: 0.3,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(
        `[SFX] ElevenLabs ${res.status} for "${description.slice(0, 50)}": ${txt.slice(0, 100)}`,
      );
      return false;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buf);
    return true;
  } catch (err) {
    console.warn(`[SFX] Failed for "${description.slice(0, 50)}":`, err);
    return false;
  }
}

/** Write a silent MP3 placeholder of approximately the requested duration */
export function writeSilence(durationMs: number, outputPath: string): void {
  // Minimal valid 1-second silence WAV (will be stretched by FFmpeg if needed)
  const sampleRate = 24000;
  const samples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataLen = samples * 2; // 16-bit mono
  const wav = Buffer.alloc(44 + dataLen, 0);
  let o = 0;
  wav.write("RIFF", o); o += 4;
  wav.writeUInt32LE(36 + dataLen, o); o += 4;
  wav.write("WAVE", o); o += 4;
  wav.write("fmt ", o); o += 4;
  wav.writeUInt32LE(16, o); o += 4;
  wav.writeUInt16LE(1, o); o += 2;  // PCM
  wav.writeUInt16LE(1, o); o += 2;  // mono
  wav.writeUInt32LE(sampleRate, o); o += 4;
  wav.writeUInt32LE(sampleRate * 2, o); o += 4;
  wav.writeUInt16LE(2, o); o += 2;
  wav.writeUInt16LE(16, o); o += 2;
  wav.write("data", o); o += 4;
  wav.writeUInt32LE(dataLen, o);
  // rest is zeros — silence
  fs.writeFileSync(outputPath, wav);
}
