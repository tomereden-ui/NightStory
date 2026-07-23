"use client";

import { LANGUAGE_META } from "@/lib/i18n";
import type { Language } from "@/types";

interface LanguageMismatchModalProps {
  /** The language the user's own typed text actually appears to be written in. */
  detectedLanguage: string;
  /** The language currently selected in the toggle. */
  selectedLanguage: string;
  onChoose: (language: string) => void;
}

// Surfaces a genuine fork in user intent — the toggle and the user's own
// words disagree — rather than silently picking either one. Kept separate
// from the language-instruction fix in generate-story/five-question-story
// (that fix makes the toggle's choice reliable once made; this modal is
// only for the case where the toggle and the actual typed content
// disagree, which the system genuinely can't resolve on its own).
export default function LanguageMismatchModal({ detectedLanguage, selectedLanguage, onChoose }: LanguageMismatchModalProps) {
  const detectedMeta = LANGUAGE_META[detectedLanguage as Language];
  const selectedMeta = LANGUAGE_META[selectedLanguage as Language];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(5,8,20,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
        style={{ background: "#0d1120", border: "1px solid rgba(79,195,247,0.2)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 22 }}>🌐</span>
          <p className="text-fs-heading font-bold" style={{ color: "#fff" }}>Which language?</p>
        </div>
        <p className="text-fs-body leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
          This looks like it's written in <strong style={{ color: "#4fc3f7" }}>{detectedMeta?.label ?? detectedLanguage}</strong>, but{" "}
          <strong style={{ color: "#4fc3f7" }}>{selectedMeta?.label ?? selectedLanguage}</strong> is selected. Which should we use for this story?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onChoose(detectedLanguage)}
            className="w-full py-3 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F" }}
          >
            {detectedMeta?.flag && <span>{detectedMeta.flag}</span>}
            <span>{detectedMeta?.label ?? detectedLanguage}</span>
          </button>
          <button
            onClick={() => onChoose(selectedLanguage)}
            className="w-full py-3 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
          >
            {selectedMeta?.flag && <span>{selectedMeta.flag}</span>}
            <span>{selectedMeta?.label ?? selectedLanguage}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
