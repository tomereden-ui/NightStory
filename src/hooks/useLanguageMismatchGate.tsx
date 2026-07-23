"use client";

import { useCallback, useRef, useState } from "react";
import { findLanguageMismatch } from "@/lib/scriptLanguageCheck";
import LanguageMismatchModal from "@/components/studio/LanguageMismatchModal";

/**
 * Gates story generation on a quick, free, instant script-based check of
 * what the user actually typed against the currently selected language —
 * only surfaces a dialog when they genuinely disagree (see
 * scriptLanguageCheck.ts). Returns a promise that resolves to whichever
 * language should actually be used: the selection unchanged when there's no
 * conflict (the common case, resolves synchronously-ish on the next tick),
 * or whatever the user picks in the dialog when there is one.
 */
export function useLanguageMismatchGate() {
  const [conflict, setConflict] = useState<{ detected: string; selected: string } | null>(null);
  const resolverRef = useRef<((language: string) => void) | null>(null);

  const checkLanguage = useCallback((text: string, selectedLanguage: string): Promise<string> => {
    const mismatch = findLanguageMismatch(text, selectedLanguage);
    if (!mismatch) return Promise.resolve(selectedLanguage);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConflict({ detected: mismatch, selected: selectedLanguage });
    });
  }, []);

  const modal = conflict ? (
    <LanguageMismatchModal
      detectedLanguage={conflict.detected}
      selectedLanguage={conflict.selected}
      onChoose={(language) => {
        resolverRef.current?.(language);
        resolverRef.current = null;
        setConflict(null);
      }}
    />
  ) : null;

  return { checkLanguage, languageMismatchModal: modal };
}
