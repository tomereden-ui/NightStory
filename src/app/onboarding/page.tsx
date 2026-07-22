"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import { AVATAR_OPTIONS, THEME_OPTIONS } from "@/components/studio/ChildProfilePicker";
import { fetchBankAvatars, type BankAvatar } from "@/lib/services/characterAvatars";
import { getLessonsCatalog } from "@/constants/lessonsUi";
import Icon from "@/components/ui/Icon";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import { useLanguage } from "@/context/LanguageContext";

const ONBOARDING_DONE_KEY = "ns-onboarding-done";

type Step = "intro" | "name" | "age" | "gender" | "avatar" | "themes" | "figures" | "lessons" | "review";
const STEP_ORDER: Step[] = ["name", "age", "gender", "avatar", "themes", "figures", "lessons"];

interface ChildDraft {
  name: string;
  age: number | null;
  gender: "boy" | "girl" | "other" | null;
  avatar: string;
  themes: string[];
  figures: string[];
  lessons: string[];
  // TTS-only respelling the parent confirmed via "Does this sound right?" —
  // never shown anywhere, only used to correct pronunciation when this
  // child's real name is spoken in story audio. Unset until confirmed.
  pronunciationOverride?: string;
}

const EMPTY_DRAFT: ChildDraft = { name: "", age: null, gender: null, avatar: "⭐", themes: [], figures: [], lessons: [] };

// Matches the ids in FIGURE_IMAGE_PROMPTS (src/config/createFlowImages.ts) —
// emoji here are only the instant-paint placeholder shown before that
// story's illustrated card image streams in from the seeder.
const FIGURES: { id: string; label: string; emoji: string }[] = [
  { id: "prince", label: "Prince", emoji: "🤴" },
  { id: "princess", label: "Princess", emoji: "👸" },
  { id: "dragon", label: "Dragon", emoji: "🐉" },
  { id: "unicorn", label: "Unicorn", emoji: "🦄" },
  { id: "ninja", label: "Ninja", emoji: "🥷" },
  { id: "robot", label: "Robot", emoji: "🤖" },
  { id: "knight", label: "Knight", emoji: "⚔️" },
  { id: "mermaid", label: "Mermaid", emoji: "🧜‍♀️" },
  { id: "wizard", label: "Wizard", emoji: "🧙" },
  { id: "superhero", label: "Superhero", emoji: "🦸" },
];

const AGE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function finishOnboarding(router: ReturnType<typeof useRouter>) {
  try { localStorage.setItem(ONBOARDING_DONE_KEY, "1"); } catch { /* ignore */ }
  router.replace("/home");
}

export default function OnboardingPage() {
  const router = useRouter();
  const { language: appLanguage } = useLanguage();

  const [step, setStep] = useState<Step>("intro");
  const [draft, setDraft] = useState<ChildDraft>(EMPTY_DRAFT);
  const [savedChildren, setSavedChildren] = useState<DBChildProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [figureImages, setFigureImages] = useState<Record<string, string>>({});
  const [imagesGenerating, setImagesGenerating] = useState(false);

  // ─── Name pronunciation preview ────────────────────────────────────────────
  // "Hear it" on the name step: ask Gemini for a phonetic respelling biased
  // toward the parent's country (from IP geolocation, already resolved into
  // user_profiles.country_code the moment they logged in — see AuthContext),
  // then synthesize THAT respelling so the child's name comes back sounding
  // the way it's actually meant to, not however a generic TTS voice would
  // guess it cold.
  //
  // The whole pipeline (country lookup → Gemini respelling → TTS) only ever
  // runs when the parent explicitly clicks the button — it used to fire on
  // a debounce while typing, which burned a Gemini + TTS call for every
  // half-finished name and played audio the parent never asked to hear.
  const [pronunciationAudio, setPronunciationAudio] = useState<{ name: string; text: string; readable: string; data: string; mimeType: string } | null>(null);
  const [pronunciationLoading, setPronunciationLoading] = useState(false);
  const [pronunciationError, setPronunciationError] = useState(false);
  const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);
  const [pronunciationPlaying, setPronunciationPlaying] = useState(false);

  // "Does this sound right?" confirm step, shown once audio for the current
  // name has played. null = not yet answered; true = confirmed correct
  // (saved as the override); false = rejected, showing the 5-alternative
  // picker below.
  const [pronunciationConfirmed, setPronunciationConfirmed] = useState<boolean | null>(null);
  const [alternatives, setAlternatives] = useState<{ text: string; readable: string; data: string; mimeType: string; isOriginal?: boolean }[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<number | null>(null);
  // "Get 5 more options" — one extra round only, offered once the parent has
  // seen the original guess + first 5 alternatives and still isn't happy.
  const [moreAlternativesLoading, setMoreAlternativesLoading] = useState(false);
  const [moreAlternativesUsed, setMoreAlternativesUsed] = useState(false);

  // While the parent has heard the name but hasn't said yes/no (or is
  // reviewing alternatives after saying no), the step isn't complete —
  // hide "Next" so they can't skip past an unanswered decision.
  const pronunciationDecisionPending =
    step === "name" &&
    !!pronunciationAudio &&
    pronunciationAudio.name === draft.name.trim() &&
    (pronunciationConfirmed === null || pronunciationConfirmed === false);

  // A fresh name (the parent kept typing after already hearing/confirming
  // one) restarts the whole confirm cycle — stale audio/confirmation for a
  // name they've since changed would otherwise silently linger.
  useEffect(() => {
    setPronunciationConfirmed(null);
    setAlternatives([]);
    setSelectedAlternative(null);
    setMoreAlternativesUsed(false);
  }, [draft.name]);

  const playAudioData = useCallback((data: string, mimeType: string) => {
    pronunciationAudioRef.current?.pause();
    const audio = new Audio(`data:${mimeType};base64,${data}`);
    pronunciationAudioRef.current = audio;
    audio.onended = () => setPronunciationPlaying(false);
    audio.onerror = () => setPronunciationPlaying(false);
    setPronunciationPlaying(true);
    audio.play().catch(() => setPronunciationPlaying(false));
  }, []);

  const handleHearName = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) return;

    // Already generated for this exact name — just replay, no re-fetch.
    if (pronunciationAudio && pronunciationAudio.name === name) {
      playAudioData(pronunciationAudio.data, pronunciationAudio.mimeType);
      return;
    }

    setPronunciationLoading(true);
    setPronunciationError(false);
    try {
      // Hardcoded for now — onboarding is Israel-only at launch, and IP-based
      // detect-country was coming back "unknown" in practice, which fell
      // through to Gemini guessing the name's origin blind instead of
      // biasing toward Hebrew.
      const countryCode = "IL";

      const pronRes = await fetch("/api/name-pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode }),
      }).then((r) => r.json()).catch(() => null);
      const pronunciation: string = pronRes?.pronunciation || name;
      const readable: string = pronRes?.readable || pronunciation;

      const synthesize = (text: string, assignedVoiceId?: string) =>
        fetch("/api/synthesize-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, characterName: "Narrator", assignedVoiceId, language: appLanguage }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

      // Gemini TTS has a known intermittent failure mode — HTTP 200,
      // finishReason "OTHER", zero audio bytes — for a single bare word
      // with no punctuation (confirmed: "yoni" and "Maya" both failed
      // exactly that way, same voice, and both succeeded the instant a
      // trailing period was added — same voice, same text otherwise). So
      // that period is no longer a fallback attempt, it's just always
      // there. One retry left for whatever's still voice-specific: the
      // raw name, default voice, in case Leda (or whichever voice the
      // parent has saved) is the problem rather than the input itself.
      let usedText = `${pronunciation}.`;
      let speechRes = await synthesize(usedText, getNarratorVoiceId());
      if (!speechRes?.audioData) {
        usedText = `${name}.`;
        speechRes = await synthesize(usedText);
      }

      if (speechRes?.audioData) {
        const mimeType = speechRes.mimeType ?? "audio/wav";
        setPronunciationAudio({ name, text: usedText.replace(/\.$/, ""), readable, data: speechRes.audioData, mimeType });
        playAudioData(speechRes.audioData, mimeType);
      } else {
        setPronunciationError(true);
      }
    } catch {
      setPronunciationError(true);
    } finally {
      setPronunciationLoading(false);
    }
  }, [draft.name, pronunciationAudio, playAudioData, appLanguage]);

  const [bankAvatars, setBankAvatars] = useState<BankAvatar[]>([]);
  useEffect(() => {
    fetchBankAvatars().then((all) => setBankAvatars(all.filter((a) => a.type === "child"))).catch(() => {});
  }, []);

  // Seed the 10 figure card images (shared seeder/bucket with the 5-question
  // wizard's option cards) — reuse whatever's already cached, generate only
  // what's genuinely missing so returning users see instant artwork.
  useEffect(() => {
    let cancelled = false;
    async function seedFigureImages() {
      try {
        const res = await fetch("/api/admin/seed-create-images");
        if (!res.ok) return;
        const { missing, existingImageUrls } = await res.json() as {
          missing: { key: string; prompt: string }[];
          existingImageUrls: Record<string, string>;
        };

        const cachedFigures = Object.fromEntries(
          Object.entries(existingImageUrls ?? {}).filter(([k]) => k.startsWith("figure-"))
        );
        if (Object.keys(cachedFigures).length > 0) {
          setFigureImages((prev) => ({ ...prev, ...cachedFigures }));
        }

        const missingFigures = (missing ?? []).filter((m) => m.key.includes("-figure-"));
        if (missingFigures.length === 0) return;

        setImagesGenerating(true);
        await Promise.all(missingFigures.map(async ({ key, prompt }) => {
          if (cancelled) return;
          try {
            const genRes = await fetch(`/api/admin/seed-create-images?key=${encodeURIComponent(key)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt }),
            });
            if (genRes.ok) {
              const { imageKey, url } = await genRes.json() as { imageKey: string; url: string };
              if (imageKey && url) setFigureImages((prev) => ({ ...prev, [imageKey]: url }));
            }
          } catch { /* keep emoji placeholder for this card */ }
        }));
        if (!cancelled) setImagesGenerating(false);
      } catch { /* keep emoji placeholders for every card */ }
    }
    seedFigureImages();
    return () => { cancelled = true; };
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);

  // Gender-matching avatars first (still shows every child avatar — just
  // reordered — so "other"/skipped gender never narrows the choices).
  const sortedBankAvatars = useMemo(() => {
    if (!draft.gender || draft.gender === "other") return bankAvatars;
    return [...bankAvatars].sort((a, b) => {
      const aMatch = a.gender === draft.gender ? 0 : 1;
      const bMatch = b.gender === draft.gender ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [bankAvatars, draft.gender]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    setStep(STEP_ORDER[stepIndex - 1]);
  }, [stepIndex]);

  const saveChild = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/child-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim() || "Little Dreamer",
          age: draft.age ?? 5,
          gender: draft.gender ?? "other",
          avatar_emoji: draft.avatar || "⭐",
          favorite_themes: draft.themes,
          preferred_figures: draft.figures,
          default_moral_lessons: draft.lessons,
          pronunciation_override: draft.pronunciationOverride || undefined,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const created = await res.json() as DBChildProfile;
      setSavedChildren((prev) => [...prev, created]);
      setStep("review");
    } catch {
      setSaveError("Couldn't save right now — you can try again, or skip for now.");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const goNext = useCallback(() => {
    if (stepIndex === STEP_ORDER.length - 1) {
      saveChild();
      return;
    }
    setStep(STEP_ORDER[stepIndex + 1]);
  }, [stepIndex, saveChild]);

  // "Yes, that's right" — whatever text was actually spoken (the respelling,
  // or the raw name if that's what succeeded) becomes the confirmed
  // pronunciation override, and onboarding advances automatically.
  const confirmPronunciationYes = useCallback(() => {
    if (!pronunciationAudio) return;
    setDraft((p) => ({ ...p, pronunciationOverride: pronunciationAudio.text }));
    setPronunciationConfirmed(true);
    goNext();
  }, [pronunciationAudio, goNext]);

  // Shared by the initial 5-alternative fetch and the one-time "5 more" —
  // asks Gemini for 5 respellings distinct from everything in `rejectedTexts`,
  // then synthesizes all 5 in parallel.
  const fetchAlternativeBatch = useCallback(async (rejectedTexts: string[]) => {
    if (!pronunciationAudio) return [];
    // Hardcoded for now — see handleHearName above.
    const countryCode = "IL";

    const altRes = await fetch("/api/name-pronunciation-alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pronunciationAudio.name, countryCode, rejected: rejectedTexts }),
    }).then((r) => r.json()).catch(() => null);
    // { text: TTS-only respelling (may be a different script), readable:
    // plain-Latin phonetic spelling shown to the parent } — see
    // /api/name-pronunciation-alternatives for how these are generated.
    const options: { text: string; readable: string }[] = Array.isArray(altRes?.alternatives) ? altRes.alternatives : [];

    // Synthesize all 5 in parallel — same trailing-period fix as the main
    // pronunciation attempt (a bare single word reliably fails Gemini TTS).
    const results = await Promise.all(options.map(({ text }) =>
      fetch("/api/synthesize-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${text}.`, characterName: "Narrator", assignedVoiceId: getNarratorVoiceId(), language: appLanguage }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ));

    return options
      .map(({ text, readable }, i) => ({ text, readable, data: results[i]?.audioData as string | undefined, mimeType: results[i]?.mimeType as string | undefined ?? "audio/wav" }))
      .filter((a): a is { text: string; readable: string; data: string; mimeType: string } => !!a.data);
  }, [pronunciationAudio, appLanguage]);

  // "No, that's not right" — the option list opens with the original guess
  // the parent just heard (so they can reconsider it alongside the rest,
  // rather than losing it) followed by 5 fresh alternatives from Gemini.
  const rejectPronunciation = useCallback(async () => {
    if (!pronunciationAudio) return;
    setPronunciationConfirmed(false);
    setAlternativesLoading(true);
    setAlternatives([{ text: pronunciationAudio.text, readable: pronunciationAudio.readable, data: pronunciationAudio.data, mimeType: pronunciationAudio.mimeType, isOriginal: true }]);
    setSelectedAlternative(null);
    setMoreAlternativesUsed(false);
    try {
      const built = await fetchAlternativeBatch([pronunciationAudio.text]);
      setAlternatives((prev) => [...prev, ...built]);
    } finally {
      setAlternativesLoading(false);
    }
  }, [pronunciationAudio, fetchAlternativeBatch]);

  // "None of these sound right?" — one extra, final round of 5 more options,
  // excluding every respelling already shown (original + first 5).
  const fetchMoreAlternatives = useCallback(async () => {
    setMoreAlternativesLoading(true);
    try {
      const built = await fetchAlternativeBatch(alternatives.map((a) => a.text));
      setAlternatives((prev) => [...prev, ...built]);
      setMoreAlternativesUsed(true);
    } finally {
      setMoreAlternativesLoading(false);
    }
  }, [alternatives, fetchAlternativeBatch]);

  // Play just previews — it doesn't select. Selecting is a separate action
  // (a distinct "closest one" pick) so the parent can listen to a few before
  // committing, rather than the act of listening also being the commit.
  const playAlternative = useCallback((index: number) => {
    const alt = alternatives[index];
    if (alt) playAudioData(alt.data, alt.mimeType);
  }, [alternatives, playAudioData]);

  const selectAlternative = useCallback((index: number) => {
    setSelectedAlternative(index);
  }, []);

  // Confirms whichever alternative is currently selected and advances —
  // same "confirmed, move on" shape as answering "yes" to the first
  // suggestion, just one extra step for picking which one.
  const confirmSelectedAlternative = useCallback(() => {
    if (selectedAlternative === null) return;
    const alt = alternatives[selectedAlternative];
    if (!alt) return;
    setDraft((p) => ({ ...p, pronunciationOverride: alt.text }));
    setPronunciationConfirmed(true);
    goNext();
  }, [selectedAlternative, alternatives, goNext]);

  const startAnotherChild = () => {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
    setStep("name");
    // A new child needs a fresh pronunciation cycle — otherwise the
    // previous child's audio/confirmation would carry over.
    setPronunciationAudio(null);
    setPronunciationConfirmed(null);
    setAlternatives([]);
    setSelectedAlternative(null);
  };

  const toggleTheme = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      themes: prev.themes.includes(id) ? prev.themes.filter((t) => t !== id) : [...prev.themes, id],
    }));
  };

  const toggleFigure = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      figures: prev.figures.includes(id) ? prev.figures.filter((f) => f !== id) : [...prev.figures, id],
    }));
  };

  const toggleLesson = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      lessons: prev.lessons.includes(id) ? prev.lessons.filter((l) => l !== id) : [...prev.lessons, id],
    }));
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center px-6 py-8 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #040612 0%, #0d0f22 60%, #080b18 100%)" }}
    >
      {/* Splash artwork background — intro screen only; the form steps below
          stay on the plain dark gradient so grids/inputs read clearly. */}
      {step === "intro" && (
        <div className="fixed inset-0" style={{ background: "#050210", zIndex: 0 }}>
          <Image
            src="/splash-family.png"
            alt=""
            fill
            priority
            style={{ objectFit: "cover", objectPosition: "center 20%", opacity: 0.85 }}
          />
          <div className="absolute inset-0" style={{
            background: "linear-gradient(180deg, rgba(4,6,18,0.35) 0%, rgba(4,6,18,0.55) 35%, rgba(8,11,24,0.88) 68%, rgba(5,2,16,0.97) 100%)",
          }} />
        </div>
      )}

      {/* Top bar — back + progress + skip-all */}
      <div className="relative w-full flex items-center justify-between mb-8" style={{ maxWidth: 420, zIndex: 1 }}>
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
          style={{
            background: "rgba(255,255,255,0.06)",
            visibility: stepIndex > 0 ? "visible" : "hidden",
          }}
          aria-label="Back"
        >
          <Icon name="back" size={14} />
        </button>

        {stepIndex >= 0 && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              {STEP_ORDER.map((s, i) => (
                <div
                  key={s}
                  className="rounded-full transition-all"
                  style={{
                    width: i === stepIndex ? 20 : 6,
                    height: 6,
                    background: i < stepIndex
                      ? "linear-gradient(90deg,#4fc3f7,#a78bfa)"
                      : i === stepIndex
                        ? "linear-gradient(90deg,#4fc3f7,#a78bfa)"
                        : "rgba(255,255,255,0.14)",
                    boxShadow: i === stepIndex ? "0 0 10px rgba(79,195,247,0.55)" : "none",
                  }}
                />
              ))}
            </div>
            <p
              className="font-bold uppercase tracking-widest"
              style={{ fontSize: 9, color: "rgba(148,163,184,0.55)" }}
            >
              Step {stepIndex + 1} of {STEP_ORDER.length}
            </p>
          </div>
        )}

        {(step === "intro" || STEP_ORDER.includes(step)) ? (
          <button
            onClick={() => finishOnboarding(router)}
            className="text-fs-body font-medium"
            style={{ color: "rgba(148,163,184,0.8)" }}
          >
            Skip for now
          </button>
        ) : <div style={{ width: 36 }} />}
      </div>

      <div className="relative w-full flex-1 flex flex-col" style={{ maxWidth: 420, zIndex: 1 }}>
        {step === "intro" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 20px rgba(167,139,250,0.4))" }}>🌙✨</span>
            <h1 className="font-bold" style={{ fontSize: 26, color: "#e2e8f0" }}>Let&apos;s meet your family</h1>
            <p className="text-fs-body leading-relaxed" style={{ color: "rgba(148,163,184,0.9)", maxWidth: 320 }}>
              Tell us a little about your child so every story feels made just for them. It only takes a minute — and you can skip anything.
            </p>
            <button
              onClick={() => setStep("name")}
              className="w-full py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.98] mt-4"
              style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)", fontSize: 15 }}
            >
              Add my child
            </button>
          </div>
        )}

        {step === "name" && (
          <StepShell stepKey="name" icon="👋" title="What's your child's name?" subtitle="This is how Luna and every story will greet them.">
            <input
              type="text"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="Child's name"
              maxLength={30}
              className="w-full px-4 py-3.5 rounded-2xl text-white outline-none text-center font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.25)", fontSize: 18 }}
            />
            {draft.name.trim().length >= 2 && (
              <>
                <button
                  onClick={handleHearName}
                  disabled={pronunciationLoading}
                  className="mx-auto mt-3 flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: "rgba(79,195,247,0.1)",
                    border: "1px solid rgba(79,195,247,0.3)",
                    color: "#4fc3f7",
                    fontSize: 13,
                  }}
                >
                  {pronunciationLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
                      <span>Listening for the right sound…</span>
                    </>
                  ) : (
                    <>
                      <span>{pronunciationPlaying ? "🔊" : "▶"}</span>
                      <span>Hear &quot;{draft.name.trim()}&quot;</span>
                    </>
                  )}
                </button>
                {pronunciationError && (
                  <p className="text-center mt-2" style={{ color: "rgba(248,113,113,0.85)", fontSize: 12 }}>
                    Couldn&apos;t generate the pronunciation — tap to try again
                  </p>
                )}

                {/* "Does this sound right?" — shown once audio for the
                    CURRENT name has played and hasn't been answered yet.
                    Framed as a required checkpoint (not an aside) since the
                    footer's Next button is hidden until this is answered. */}
                {pronunciationAudio && pronunciationAudio.name === draft.name.trim() && pronunciationConfirmed === null && !pronunciationLoading && (
                  <div
                    className="mt-4 p-4 rounded-2xl text-center"
                    style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)" }}
                  >
                    <p className="text-fs-body font-semibold mb-3" style={{ color: "#e2e8f0" }}>Does that sound right?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={confirmPronunciationYes}
                        className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg,#10b981,#34d399)", color: "#052e1f", fontSize: 13 }}
                      >
                        ✓ Yes, that&apos;s right
                      </button>
                      <button
                        onClick={rejectPronunciation}
                        className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}
                      >
                        ✕ Not quite
                      </button>
                    </div>
                  </div>
                )}

                {/* Rejected — the list opens with the original guess the
                    parent just heard (isOriginal, tagged below) followed by
                    5 fresh alternatives; each row has its own play button,
                    picking one just selects/highlights it (so the parent can
                    preview a few before committing) — a separate confirm
                    button actually saves the choice and moves on. Each row's
                    label is a plain-Latin phonetic respelling ("readable")
                    Gemini generates alongside the actual TTS-only text
                    ("text") so the parent has a hint of what they're about
                    to tap play on, even when the TTS text itself uses a
                    different script. "Get 5 more" offers exactly one further
                    round if nothing in the first 6 is close enough. */}
                {pronunciationConfirmed === false && (
                  <div
                    className="mt-4 p-4 rounded-2xl"
                    style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)" }}
                  >
                    <p className="text-fs-body font-semibold text-center mb-3" style={{ color: "#e2e8f0" }}>
                      Pick whichever sounds closest:
                    </p>
                    <div className="flex flex-col gap-2">
                      {alternatives.map((alt, i) => (
                        <div
                          key={i}
                          onClick={() => selectAlternative(i)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
                          style={{
                            background: selectedAlternative === i ? "rgba(79,195,247,0.14)" : "rgba(255,255,255,0.04)",
                            border: selectedAlternative === i ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); playAlternative(i); }}
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                            style={{ background: "rgba(79,195,247,0.15)", color: "#4fc3f7" }}
                          >
                            ▶
                          </button>
                          <span className="flex-1 text-fs-body font-medium text-left" style={{ color: selectedAlternative === i ? "#4fc3f7" : "rgba(255,255,255,0.75)" }}>
                            {alt.readable}
                            {alt.isOriginal && (
                              <span className="ml-1.5" style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", fontWeight: 400 }}>(first suggestion)</span>
                            )}
                          </span>
                          {selectedAlternative === i && <span style={{ color: "#4fc3f7" }}>✓</span>}
                        </div>
                      ))}
                      {(alternativesLoading || moreAlternativesLoading) && (
                        <div className="flex justify-center py-3">
                          <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
                        </div>
                      )}
                    </div>
                    {!alternativesLoading && alternatives.length > 0 && (
                      <button
                        onClick={confirmSelectedAlternative}
                        disabled={selectedAlternative === null}
                        className="w-full mt-3 py-2.5 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)", color: "#fff", fontSize: 13 }}
                      >
                        Use this pronunciation
                      </button>
                    )}
                    {!alternativesLoading && !moreAlternativesUsed && alternatives.length > 0 && (
                      <button
                        onClick={fetchMoreAlternatives}
                        disabled={moreAlternativesLoading}
                        className="w-full mt-2 py-2 text-center font-medium disabled:opacity-50"
                        style={{ color: "rgba(148,163,184,0.8)", fontSize: 12 }}
                      >
                        {moreAlternativesLoading ? "Finding a few more…" : "None of these? Get 5 more options"}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </StepShell>
        )}

        {step === "age" && (
          <StepShell stepKey="age" icon="🎂" title="How old are they?" subtitle="Stories adjust their pacing and vocabulary to fit.">
            <div className="flex flex-wrap justify-center gap-2.5">
              {AGE_OPTIONS.map((n) => {
                const active = draft.age === n;
                return (
                  <button
                    key={n}
                    onClick={() => setDraft((p) => ({ ...p, age: n }))}
                    className="rounded-full font-bold transition-all active:scale-90"
                    style={{
                      width: 52, height: 52,
                      background: active
                        ? "linear-gradient(150deg,#4fc3f7,#8B5CF6)"
                        : "rgba(255,255,255,0.05)",
                      border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: active
                        ? "0 0 18px rgba(79,195,247,0.45), inset 0 1px 1px rgba(255,255,255,0.3)"
                        : "inset 0 1px 1px rgba(255,255,255,0.05)",
                      color: active ? "#fff" : "rgba(255,255,255,0.65)",
                      fontSize: 17,
                      transform: active ? "scale(1.08)" : "scale(1)",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </StepShell>
        )}

        {step === "gender" && (
          <StepShell stepKey="gender" icon="🌈" title="Boy, girl, or other?" subtitle="Helps us pick the right character voice.">
            <div className="flex gap-2.5">
              {(["boy", "girl", "other"] as const).map((g) => {
                const active = draft.gender === g;
                const emoji = g === "boy" ? "👦" : g === "girl" ? "👧" : "🌈";
                return (
                  <button
                    key={g}
                    onClick={() => setDraft((p) => ({ ...p, gender: g }))}
                    className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl font-semibold capitalize transition-all active:scale-95"
                    style={{
                      background: active ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.04)",
                      border: active ? "1.5px solid rgba(79,195,247,0.45)" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: active ? "0 0 16px rgba(79,195,247,0.15)" : "none",
                      color: active ? "#4fc3f7" : "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      transform: active ? "scale(1.03)" : "scale(1)",
                    }}
                  >
                    <span style={{ fontSize: 26 }}>{emoji}</span>
                    {g}
                  </button>
                );
              })}
            </div>
          </StepShell>
        )}

        {step === "avatar" && (
          <StepShell stepKey="avatar" icon="🎭" title="Pick an avatar" subtitle="Shown next to their name throughout the app.">
            {sortedBankAvatars.length > 0 ? (
              <div className="grid grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto pr-0.5">
                {sortedBankAvatars.map((a) => {
                  const active = draft.avatar === a.image_url;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setDraft((p) => ({ ...p, avatar: a.image_url }))}
                      className="relative rounded-2xl overflow-hidden transition-all"
                      style={{
                        aspectRatio: "1/1",
                        background: "rgba(255,255,255,0.04)",
                        border: active ? "2px solid #4fc3f7" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.image_url} alt={a.description} className="absolute inset-0 w-full h-full object-cover" />
                      {active && (
                        <div className="absolute top-1 right-1 rounded-full flex items-center justify-center" style={{ width: 18, height: 18, background: "#4fc3f7" }}>
                          <Icon name="success" size={10} style={{ color: "#fff" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              // Bank still loading (or genuinely empty) — emoji grid keeps
              // the step usable rather than showing a blank screen.
              <div className="grid grid-cols-4 gap-2.5 justify-items-center">
                {AVATAR_OPTIONS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setDraft((p) => ({ ...p, avatar: em }))}
                    className="rounded-2xl flex items-center justify-center transition-all"
                    style={{
                      width: 56, height: 56,
                      fontSize: 26,
                      background: draft.avatar === em ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.04)",
                      border: draft.avatar === em ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </StepShell>
        )}

        {step === "themes" && (
          <StepShell
            stepKey="themes"
            icon="📚"
            title="What kind of stories do they love?"
            subtitle="Pick as many as you like — we'll lean into these."
            counter={draft.themes.length > 0 ? `${draft.themes.length} selected` : undefined}
          >
            <div className="flex flex-wrap justify-center gap-2">
              {THEME_OPTIONS.map((t) => {
                const active = draft.themes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTheme(t.id)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-medium transition-all"
                    style={{
                      background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                      border: active ? "1.5px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#a78bfa" : "rgba(255,255,255,0.55)",
                      fontSize: 15,
                    }}
                  >
                    <span>{t.emoji}</span> {t.label}
                  </button>
                );
              })}
            </div>
          </StepShell>
        )}

        {step === "figures" && (
          <StepShell
            stepKey="figures"
            icon="🦄"
            title="Which figures do they love?"
            subtitle="Pick as many as you like — we'll feature them in stories."
            counter={draft.figures.length > 0 ? `${draft.figures.length} selected` : undefined}
          >
            <div className="grid grid-cols-2 gap-2.5">
              {FIGURES.map((f) => {
                const active = draft.figures.includes(f.id);
                const img = figureImages[`figure-${f.id}`];
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFigure(f.id)}
                    className="relative flex flex-col items-center gap-1.5 rounded-2xl overflow-hidden transition-all"
                    style={{
                      aspectRatio: "1/1",
                      background: active ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.04)",
                      border: active ? "1.5px solid #4fc3f7" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={f.label} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-fs-display">
                        {f.emoji}
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(4,6,18,0.9) 100%)" }} />
                    <span className="absolute bottom-2 left-0 right-0 text-center text-fs-body font-bold text-white">{f.label}</span>
                    {active && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#4fc3f7" }}>
                        <Icon name="success" size={12} style={{ color: "#fff" }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {imagesGenerating && (
              <p className="text-center text-fs-body mt-3" style={{ color: "rgba(148,163,184,0.7)" }}>✨ Painting the rest of the artwork…</p>
            )}
          </StepShell>
        )}

        {step === "lessons" && (
          <StepShell
            stepKey="lessons"
            icon="💫"
            title="Want stories to teach something?"
            subtitle="Pick any values to weave into every story — optional, and you can change these later."
            counter={draft.lessons.length > 0 ? `${draft.lessons.length} selected` : undefined}
          >
            <div className="flex flex-wrap justify-center gap-2">
              {getLessonsCatalog().map((l) => {
                const active = draft.lessons.includes(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLesson(l.id)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-medium transition-all"
                    style={{
                      background: active ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.04)",
                      border: active ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#4fc3f7" : "rgba(255,255,255,0.55)",
                      fontSize: 15,
                    }}
                  >
                    <Icon name={l.icon} size={14} /> {l.label}
                  </button>
                );
              })}
            </div>
          </StepShell>
        )}

        {step === "review" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            {savedChildren[savedChildren.length - 1]?.avatar_emoji?.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={savedChildren[savedChildren.length - 1].avatar_emoji}
                alt=""
                className="rounded-full object-cover"
                style={{ width: 72, height: 72, boxShadow: "0 0 24px rgba(79,195,247,0.4)" }}
              />
            ) : (
              <span className="text-fs-display" style={{ filter: "drop-shadow(0 0 20px rgba(79,195,247,0.4))" }}>
                {savedChildren[savedChildren.length - 1]?.avatar_emoji ?? "⭐"}
              </span>
            )}
            <h1 className="font-bold" style={{ fontSize: 24, color: "#e2e8f0" }}>
              {savedChildren[savedChildren.length - 1]?.name ?? "Your child"} is ready for bedtime stories!
            </h1>
            <p className="text-fs-body" style={{ color: "rgba(148,163,184,0.9)" }}>
              {savedChildren.length} {savedChildren.length === 1 ? "child" : "children"} added so far.
            </p>
            <div className="w-full flex flex-col gap-2.5 mt-4">
              <button
                onClick={startAnotherChild}
                className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 15 }}
              >
                + Add another child
              </button>
              <button
                onClick={() => finishOnboarding(router)}
                className="w-full py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)", fontSize: 15 }}
              >
                Start exploring NightStory →
              </button>
            </div>
          </div>
        )}

        {/* Next / Skip footer — every collection step */}
        {STEP_ORDER.includes(step) && (
          <div className="flex flex-col gap-2.5 mt-6">
            {saveError && (
              <p className="text-fs-body text-center" style={{ color: "#fca5a5" }}>{saveError}</p>
            )}
            {!pronunciationDecisionPending && (
              <button
                onClick={goNext}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)", fontSize: 15 }}
              >
                {saving ? "Saving…" : stepIndex === STEP_ORDER.length - 1 ? "Finish" : "Next"}
              </button>
            )}
            {!pronunciationDecisionPending && stepIndex < STEP_ORDER.length - 1 && (
              <button
                onClick={goNext}
                className="text-fs-body font-medium mx-auto"
                style={{ color: "rgba(148,163,184,0.75)" }}
              >
                Skip this step
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  icon,
  counter,
  stepKey,
  children,
}: {
  title: string;
  subtitle: string;
  /** Emoji shown in a glowing badge above the title — gives each step its
   *  own visual anchor instead of every step reading as the same plain
   *  title/subtitle/options template. */
  icon?: string;
  /** e.g. "3 selected" for multi-pick steps — shown as a small pill under
   *  the subtitle, so picking something gives visible feedback beyond the
   *  option itself lighting up. */
  counter?: string;
  /** Remounts this shell on step change so onboarding-step-in replays —
   *  without a changing key, a CSS animation class that's already applied
   *  doesn't restart on its own. */
  stepKey: string;
  children: React.ReactNode;
}) {
  return (
    <div key={stepKey} className="flex-1 flex flex-col justify-center gap-6 onboarding-step-in">
      <div className="text-center">
        {icon && (
          <div
            className="mx-auto mb-3 flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "linear-gradient(135deg, rgba(79,195,247,0.16), rgba(167,139,250,0.16))",
              border: "1px solid rgba(167,139,250,0.3)",
              boxShadow: "0 0 24px rgba(79,195,247,0.18)",
              fontSize: 26,
            }}
          >
            {icon}
          </div>
        )}
        <h1 className="font-bold mb-1.5" style={{ fontSize: 22, color: "#e2e8f0" }}>{title}</h1>
        <p className="text-fs-body" style={{ color: "rgba(148,163,184,0.9)" }}>{subtitle}</p>
        {counter && (
          <span
            className="inline-block mt-2 font-bold uppercase tracking-widest"
            style={{
              fontSize: 10,
              color: "#4fc3f7",
              background: "rgba(79,195,247,0.1)",
              border: "1px solid rgba(79,195,247,0.25)",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            {counter}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
