// Display-only formatting for a script line's leading [performance tag]
// (e.g. "[warmly] Once upon a time..."). The tag stays in the underlying
// textPayload and in what's sent to TTS — Gemini 3.1's own audio-tag feature
// reads that exact bracket syntax to control delivery, so it must never be
// stripped from the synthesis payload (see ttsService.ts). This is purely
// for read-only script views where showing the raw "[warmly]" bracket inline
// reads as a typo, not a stage direction.
export function stripPerformanceTag(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, "").replace(/\s{2,}/g, " ").trim();
}
