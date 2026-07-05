// Canned sample line used to preview every voice, translated into each
// language the app supports voice previews for. Same content across
// languages so previews are comparable voice-to-voice.
export const PREVIEW_LANGUAGES = ["en", "he"] as const;
export type PreviewLanguage = (typeof PREVIEW_LANGUAGES)[number];

export const PREVIEW_SAMPLE_TEXT: Record<PreviewLanguage, string> = {
  en: "Hello. This is my voice.",
  he: "שלום. זה הקול שלי.",
};
