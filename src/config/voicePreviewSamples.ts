// Canned sample line used to preview every voice, translated into each
// language the app supports voice previews for. Same content across
// languages so previews are comparable voice-to-voice.
// Mirrors SUPPORTED_LANGUAGES in lib/i18n.ts — every story language must
// have a preview sample so the picker never has to fall back to English.
export const PREVIEW_LANGUAGES = ["en", "he", "es", "fr", "de", "pt", "ar", "ja", "it", "hi"] as const;
export type PreviewLanguage = (typeof PREVIEW_LANGUAGES)[number];

export const PREVIEW_SAMPLE_TEXT: Record<PreviewLanguage, string> = {
  en: "Hello. This is my voice.",
  he: "שלום. זה הקול שלי.",
  es: "Hola. Esta es mi voz.",
  fr: "Bonjour. Voici ma voix.",
  de: "Hallo. Das ist meine Stimme.",
  pt: "Olá. Esta é a minha voz.",
  ar: "مرحبًا. هذا هو صوتي.",
  ja: "こんにちは。これは私の声です。",
  it: "Ciao. Questa è la mia voce.",
  hi: "नमस्ते। यह मेरी आवाज़ है।",
};
