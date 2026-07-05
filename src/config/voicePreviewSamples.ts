// Canned bedtime-story sentence used to preview every voice, translated into
// each language the app supports voice previews for. Same content/tone
// across languages so previews are comparable voice-to-voice.
export const PREVIEW_LANGUAGES = ["en", "he", "fr", "es"] as const;
export type PreviewLanguage = (typeof PREVIEW_LANGUAGES)[number];

export const PREVIEW_SAMPLE_TEXT: Record<PreviewLanguage, string> = {
  en: "Once upon a time, in a cozy little forest, a curious fox looked up at the twinkling stars and smiled.",
  he: "פעם אחת, ביער קטן וחמים, הביט שועל סקרן בכוכבים הנוצצים וחייך.",
  fr: "Il était une fois, dans une petite forêt douillette, un renard curieux leva les yeux vers les étoiles scintillantes et sourit.",
  es: "Érase una vez, en un bosque pequeño y acogedor, un zorro curioso miró las estrellas titilantes y sonrió.",
};
