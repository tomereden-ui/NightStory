// Detects a genuine conflict between what a user actually typed and the
// story language currently selected — restricted to non-Latin scripts
// (Hebrew/Arabic/Japanese/Hindi), which are unambiguous from character
// range alone, unlike the Latin-script languages (en/es/fr/de/pt/it), which
// share an alphabet and can't be told apart this way. No AI call needed:
// this is instant and 100% reliable for the case that actually matters here
// (see studio/page.tsx's generation-language discussion) — a story typed in
// Hebrew while a Latin-script language is selected, or vice versa.
const SCRIPT_RANGES: Record<string, RegExp> = {
  he: /[֐-׿]/,
  ar: /[؀-ۿ]/,
  ja: /[぀-ヿ一-鿿]/,
  hi: /[ऀ-ॿ]/,
};
const NON_LATIN_LANGS = Object.keys(SCRIPT_RANGES);

/**
 * Returns the language the given text actually appears to be written in,
 * if that conflicts with `selectedLanguage` — or null if there's no
 * detectable conflict (they agree, or the text is in some Latin-script
 * language that can't be distinguished from the selection by character
 * range alone, e.g. French selected but the text is Spanish).
 */
export function findLanguageMismatch(text: string, selectedLanguage: string): string | null {
  if (!text.trim()) return null;
  const textScript = NON_LATIN_LANGS.find((lang) => SCRIPT_RANGES[lang].test(text));
  if (textScript) return textScript !== selectedLanguage ? textScript : null;
  // Plain Latin-script text — only a real conflict if a non-Latin language
  // is currently selected (English is the most reasonable guess to offer
  // as the alternative, since it's this app's own default/fallback language).
  return NON_LATIN_LANGS.includes(selectedLanguage) ? "en" : null;
}

/**
 * Returns the non-Latin language the given text is unambiguously written
 * in, or null if it's plain Latin-script (or empty) — no conflict to
 * resolve, just "no signal either way" from character range alone.
 *
 * Used when the language toggle is still at its untouched default (the
 * user never actually picked anything for THIS story) — in that case there's
 * no real selection to weigh the typed text against, so the right move is
 * to trust the text directly rather than surface a dialog comparing it to a
 * value the user never chose.
 */
export function detectScriptLanguage(text: string): string | null {
  if (!text.trim()) return null;
  return NON_LATIN_LANGS.find((lang) => SCRIPT_RANGES[lang].test(text)) ?? null;
}
