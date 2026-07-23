"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import { getLuna, getMoodLabels, type LunaCopy } from "@/constants/lunaScripts";
import {
  getWizardUi, type WizardUiCopy,
  getWorldOptions, type WorldOptionMeta,
  getCompanionTypes, type CompanionTypeMeta, type Q3CompanionTypeId,
  getQ4Categories, type Q4CategoryMeta, type Q4CategoryId,
  getAnimalTypes, type AnimalTypeMeta, type AnimalTypeId,
} from "@/constants/wizardUi";
import {
  SURPRISE_HERO_NAMES,
  SURPRISE_HEROES,
  MAGICAL_NAME_CHIPS,
  SURPRISE_COMPANIONS,
  SURPRISE_ENGINES,
  pickRandom,
} from "@/constants/surprisePicks";
import ScriptTab from "@/components/studio/ScriptTab";
import { writeDraft } from "@/lib/draftStore";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import type { ScriptBlock, Voice } from "@/types";
import type { Job } from "@/lib/jobs";
import type { ResolutionMood, StorySeeds } from "@/utils/buildStoryPrompt";

// ─── Types ─────────────────────────────────────────────────────────────────────────

type Step = "q1" | "q2" | "q3" | "q4" | "q5" | "summary" | "generating" | "done";

interface Answers {
  q1_hero: string;
  q2_world: string;
  q3_companion: string;
  q4_engine: string;
  q5_mood: ResolutionMood | null;
}

export const DRAFT_KEY = "ns-wizard-draft-v1";

// ─── Free-text content check ────────────────────────────────────────────────
// Sends whatever a child typed to Gemini for a quick appropriateness + sanity
// check before the wizard advances. Fails open (approved: true) on any
// network/server hiccup — a Gemini outage should never block a bedtime story.
type WizardTextField = "heroName" | "world" | "companionName" | "challenge";

async function validateWizardText(text: string, field: WizardTextField, language: string): Promise<{ approved: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/validate-wizard-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, field, language }),
    });
    if (!res.ok) return { approved: true };
    return await res.json();
  } catch {
    return { approved: true };
  }
}

// ─── Companion display localization ─────────────────────────────────────────
// answers.q3_companion is built from CompanionTypeMeta.geminiLabel (always
// English — it's what the story-generation prompt expects), so it's never
// safe to show directly in the wizard's own UI once the language isn't
// English. This reconstructs the same {type, name} the string was built
// from and re-renders it with the localized label + ui.companionDisplay.
function localizeCompanionForDisplay(companion: string, companionTypes: CompanionTypeMeta[], ui: WizardUiCopy, animalTypes: AnimalTypeMeta[]): string {
  if (!companion) return companion;
  // A pet with a chosen species is built as "a brave dolphin named Marina"
  // (buildCompanionString's species-aware phrasing), not the generic
  // "a pet named X" the geminiLabel loop below matches — check this pattern
  // first so it doesn't fall through to the raw English string.
  for (const at of animalTypes) {
    const withName = `a brave ${at.id} named `;
    if (companion.startsWith(withName)) return ui.companionDisplay(at.label, companion.slice(withName.length));
    if (companion === `a brave ${at.id}`) return ui.companionDisplay(at.label);
  }
  for (const ct of companionTypes) {
    const withName = `a ${ct.geminiLabel} named `;
    if (companion.startsWith(withName)) return ui.companionDisplay(ct.label, companion.slice(withName.length));
    if (companion === `a ${ct.geminiLabel}`) return ui.companionDisplay(ct.label);
  }
  // Surprise picks / legacy values / custom animals don't match either
  // pattern — pass through unchanged rather than guessing.
  return companion;
}

// Q1's animal hero uses the identical "a brave {species} named {name}"
// phrasing (see Q1View.handleConfirm) — same re-localization, just without
// the companion-type fallback since a hero is never a "pet"/"friend"/etc.
function localizeHeroForDisplay(hero: string, ui: WizardUiCopy, animalTypes: AnimalTypeMeta[]): string {
  if (!hero) return hero;
  for (const at of animalTypes) {
    const withName = `a brave ${at.id} named `;
    if (hero.startsWith(withName)) return ui.companionDisplay(at.label, hero.slice(withName.length));
    if (hero === `a brave ${at.id}`) return ui.companionDisplay(at.label);
  }
  return hero;
}

// ─── FairyFigure: animated Luna fairy portrait ────────────────────────────────────

function FairyFigure({ size = 80, roll = false }: { size?: number; roll?: boolean }) {
  return (
    <div style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <style>{`
        @keyframes _owlFloat {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          30% { transform: translateY(-7px) rotate(-2deg); }
          70% { transform: translateY(-4px) rotate(1.5deg); }
        }
        @keyframes _owlRoll {
          0%   { transform: rotate(0deg)   translateY(0px)  scale(1); }
          12%  { transform: rotate(80deg)  translateY(-9px) scale(0.94, 1.08); }
          25%  { transform: rotate(180deg) translateY(0px)  scale(1); }
          37%  { transform: rotate(280deg) translateY(-9px) scale(0.94, 1.08); }
          50%  { transform: rotate(360deg) translateY(0px)  scale(1); }
          62%  { transform: rotate(440deg) translateY(-9px) scale(0.94, 1.08); }
          75%  { transform: rotate(540deg) translateY(0px)  scale(1); }
          87%  { transform: rotate(640deg) translateY(-9px) scale(0.94, 1.08); }
          100% { transform: rotate(720deg) translateY(0px)  scale(1); }
        }
        @keyframes _owlGlow {
          0%,100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.14); }
        }
        @keyframes _owlSparkle {
          0%,100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(160deg); }
        }
      `}</style>
      {/* Soft glow halo */}
      <div style={{
        position: "absolute",
        inset: -size * 0.28,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,195,247,0.35) 0%, rgba(167,139,250,0.2) 45%, transparent 70%)",
        animation: "_owlGlow 3s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/owl-avatar.png"
        alt="Luna"
        style={{
          width: size,
          height: size,
          position: "relative",
          zIndex: 1,
          borderRadius: "50%",
          // Gentle, slightly bouncy full tumble while waiting on something
          // long-running (script generation) — a playful "rolling" motion
          // rather than the everyday idle float used everywhere else.
          animation: roll ? "_owlRoll 6s ease-in-out infinite" : "_owlFloat 4s ease-in-out infinite",
          filter: "drop-shadow(0 0 10px rgba(79,195,247,0.5)) drop-shadow(0 2px 8px rgba(167,139,250,0.4))",
        }}
      />
      {/* Sparkles */}
      <span style={{ position: "absolute", top: 0, right: -size * 0.18, fontSize: size * 0.22, zIndex: 2, animation: "_owlSparkle 2.4s ease-in-out infinite", lineHeight: 1 }}>✨</span>
      <span style={{ position: "absolute", bottom: size * 0.05, left: -size * 0.22, fontSize: size * 0.16, zIndex: 2, animation: "_owlSparkle 3s ease-in-out infinite 0.8s", lineHeight: 1 }}>⭐</span>
    </div>
  );
}

// ─── LunaLine: progressive word-by-word reveal ─────────────────────────────────

function LunaLine({
  text,
  speed = 70,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const words = text.split(" ");
  const [visible, setVisible] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisible(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setVisible(i);
      if (i >= words.length) {
        clearInterval(id);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return (
    <p className="text-white/85 text-fs-heading leading-relaxed font-light">
      {words.map((w, i) => (
        <span
          key={i}
          style={{ opacity: i < visible ? 1 : 0, transition: "opacity 0.15s ease", display: "inline" }}
        >
          {w}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

// ─── LaunchCountdown: 3-second animated pause ─────────────────────────────────

function LaunchCountdown({ onComplete }: { onComplete: () => void }) {
  const [tick, setTick] = useState(0);
  const ref = useRef(onComplete);
  ref.current = onComplete;

  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count++;
      setTick(count);
      if (count >= 3) { clearInterval(id); setTimeout(() => ref.current(), 300); }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-3 justify-center items-center my-6">
      {[0, 1, 2].map((i) => (
        <span key={i} className="rounded-full transition-all duration-700"
          style={{
            width: tick > i ? 14 : 8, height: tick > i ? 14 : 8,
            background: tick > i ? "#4fc3f7" : "rgba(79,195,247,0.2)",
            boxShadow: tick > i ? "0 0 12px rgba(79,195,247,0.7)" : "none",
          }} />
      ))}
    </div>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────────────

function OptionPill({ label, emoji, selected, onClick }: { label: string; emoji?: string; selected?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-2xl text-fs-body font-medium transition-all active:scale-[0.98] flex items-center gap-2"
      style={selected
        ? { background: "rgba(79,195,247,0.14)", border: "1px solid rgba(79,195,247,0.45)", color: "#4fc3f7" }
        : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}>
      {emoji && <span className="text-fs-heading">{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}

// ─── BackButton ────────────────────────────────────────────────────────────────────

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95 self-start"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "rgba(255,255,255,0.5)",
      }}
    >
      ← {label}
    </button>
  );
}

// ─── IllustratedCard ────────────────────────────────────────────────────────────────────

const CARD_PALETTES: [string, string][] = [
  ["#4fc3f7", "#7c3aed"],
  ["#f59e0b", "#ec4899"],
  ["#10b981", "#4fc3f7"],
  ["#a78bfa", "#f472b6"],
  ["#38bdf8", "#818cf8"],
  ["#fb923c", "#e879f9"],
  ["#34d399", "#818cf8"],
  ["#f87171", "#fbbf24"],
  ["#c084fc", "#22d3ee"],
  ["#4ade80", "#a78bfa"],
];
function cardPalette(label: string): [string, string] {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return CARD_PALETTES[h % CARD_PALETTES.length];
}

function IllustratedCard({
  label, emoji, imageUrl, selected, onClick, badge,
}: {
  label: string; emoji: string; imageUrl?: string;
  selected?: boolean; onClick: () => void; badge?: React.ReactNode;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [c1] = cardPalette(label);

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl active:scale-[0.97] transition-all"
      style={{
        aspectRatio: "16/9",
        boxShadow: selected
          ? `0 0 0 2px ${c1}, 0 8px 24px ${c1}55`
          : "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.6s ease" }}
          onLoad={() => setImgLoaded(true)}
        />
      )}
      {/* Neutral loading skeleton — no fully-"finished-looking" art is ever
          shown before the real photo, so nothing that could read as a wrong
          answer appears first. Only the option's emoji hints at what's
          loading, at low opacity, on a plain shimmering background. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          background: "linear-gradient(100deg, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 70%)",
          backgroundSize: "200% 100%",
          animation: imgLoaded ? "none" : "_cardShimmer 1.6s ease-in-out infinite",
          opacity: imgLoaded ? 0 : 1,
          transition: "opacity 0.4s ease",
          pointerEvents: "none",
        }}
      >
        <span className="text-fs-display relative" style={{ opacity: 0.25 }}>{emoji}</span>
      </div>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.02) 100%)" }}
      />
      {selected && (
        <div className="absolute inset-0" style={{ background: `${c1}14` }} />
      )}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
        {badge}
        <span
          className="text-fs-body font-bold leading-tight"
          style={{
            color: selected ? c1 : "rgba(255,255,255,0.95)",
            textShadow: "0 1px 10px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.9)",
            display: "block",
          }}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

function StoryInput({ value, onChange, placeholder, maxSoftLimit, autoFocus, onSubmit, overLimitText }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  maxSoftLimit?: number; autoFocus?: boolean; onSubmit?: () => void; overLimitText?: string;
}) {
  const over = maxSoftLimit ? value.length > maxSoftLimit : false;
  return (
    <div>
      <input autoFocus={autoFocus} type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-fs-body text-white placeholder-white/25 outline-none transition-colors"
        style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)"}` }}
        onFocus={(e) => (e.currentTarget.style.borderColor = over ? "rgba(236,72,153,0.5)" : "rgba(79,195,247,0.4)")}
        onBlur={(e)  => (e.currentTarget.style.borderColor = over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)")} />
      {over && overLimitText && <p className="text-fs-body mt-1.5" style={{ color: "#EC4899" }}>{overLimitText}</p>}
    </div>
  );
}

// ─── ExampleChips: tappable examples that populate the field ─────────────────────

function ExampleChips({ examples, onTap }: { examples: string[]; onTap: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {examples.map((ex) => (
        <button key={ex} onClick={() => onTap(ex)}
          className="px-3 py-1.5 rounded-full text-fs-body transition-all active:scale-95"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.4)",
            fontStyle: "italic",
          }}>
          {ex}
        </button>
      ))}
    </div>
  );
}

// ─── AnimalTypeChips: row of species chips (dog/cat/tiger/dolphin), each with
// its emoji as a small stand-in image — shared between Q1's "Brave animal"
// hero option and Q3's "pet" companion type so both get the same two-row
// (species, then species-specific name) picking mechanism. ────────────────
// Returns a fragment (not its own wrapping row) so callers can append extra
// chips — e.g. Q1's "+" custom-animal chip — into the exact same flex row.
function AnimalTypeChips({ animalTypes, selected, onSelect }: { animalTypes: AnimalTypeMeta[]; selected: AnimalTypeId | null; onSelect: (id: AnimalTypeId) => void }) {
  return (
    <>
      {animalTypes.map((a) => (
        <button key={a.id} onClick={() => onSelect(a.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-fs-body font-semibold transition-all active:scale-95"
          style={selected === a.id
            ? { background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
          <span className="text-fs-heading">{a.emoji}</span>
          <span>{a.label}</span>
        </button>
      ))}
    </>
  );
}

// ─── ConfirmRow: confirm (left primary) + skip (right ghost) on same row ──────

function ConfirmRow({ confirmLabel, onConfirm, disabled, onSkip, skipLabel }: {
  confirmLabel: string; onConfirm: () => void; disabled?: boolean; onSkip?: () => void; skipLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      <button onClick={onConfirm} disabled={disabled}
        className="flex-1 py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
        style={!disabled
          ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }
          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {confirmLabel}
      </button>
      {onSkip && (
        <button onClick={onSkip}
          className="flex-shrink-0 py-4 px-5 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}>
          {skipLabel}
        </button>
      )}
    </div>
  );
}

// ─── QuestionShell ─────────────────────────────────────────────────────────────────────────

function QuestionShell({ onBack, onReset, children, lunaText, lunaSpeed, onLunaComplete, audioUrl, ui }: {
  onBack?: () => void; onReset?: () => void; children: React.ReactNode;
  lunaText: string; lunaSpeed?: number; onLunaComplete?: () => void;
  audioUrl?: string; ui: WizardUiCopy;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); audioRef.current = null; };
  }, [audioUrl]);

  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <style>{`
        @keyframes _cardShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className="flex items-center mb-8">
        {onBack
          ? <BackButton onClick={onBack} label={ui.back} />
          : <div className="w-8" />
        }
        <div className="flex-1 flex justify-center">
          <FairyFigure size={52} />
        </div>
        {onReset ? (
          <button onClick={onReset}
            className="text-fs-body py-1.5 px-3 rounded-xl transition-all active:scale-95"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}>
            {ui.startOver}
          </button>
        ) : <div className="w-16" />}
      </div>
      <div className="mb-7">
        <LunaLine text={lunaText} speed={lunaSpeed} onComplete={onLunaComplete} />
      </div>
      {children}
    </div>
  );
}

function AutoAdvance({ delay, onAdvance }: { delay: number; onAdvance: () => void }) {
  const ref = useRef(onAdvance);
  ref.current = onAdvance;
  useEffect(() => { const id = setTimeout(() => ref.current(), delay); return () => clearTimeout(id); }, [delay]);
  return null;
}

// ─── Q1 — Hero identity ───────────────────────────────────────────────────────────────────────

type Q1Card = "own" | "magical" | "stranger" | "familyFriend" | "animal" | "surprise";

function Q1View({ initialHero, onNext, onBack, onSkip, onReset, optionImages, audioUrl, childName, childAvatarUrl, luna, ui, language, companionTypes, siblingNames, animalTypes }: { initialHero: string; onNext: (hero: string) => void; onBack?: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string; childName?: string; childAvatarUrl?: string; luna: LunaCopy; ui: WizardUiCopy; language: string; companionTypes: CompanionTypeMeta[]; siblingNames: string[]; animalTypes: AnimalTypeMeta[] }) {
  const [selectedCard, setSelectedCard] = useState<Q1Card | null>(null);
  const [textVal, setTextVal]           = useState(initialHero);
  const [magicChip, setMagicChip]       = useState<string | null>(MAGICAL_NAME_CHIPS.includes(initialHero) ? initialHero : null);
  const [animalType, setAnimalType]     = useState<AnimalTypeId | null>(null);
  // A user-typed animal not in the built-in list, confirmed by the AI check
  // in checkCustomAnimal() — englishId feeds the story-generation prompt
  // (matching the AnimalTypeId convention), label/emoji/names drive the UI.
  const [customAnimal, setCustomAnimal] = useState<{ label: string; englishId: string; emoji: string; names: string[] } | null>(null);
  const [showCustomAnimalInput, setShowCustomAnimalInput] = useState(false);
  const [customAnimalText, setCustomAnimalText] = useState("");
  const [customAnimalChecking, setCustomAnimalChecking] = useState(false);
  const [customAnimalError, setCustomAnimalError] = useState("");
  const [surpriseHero, setSurpriseHero] = useState<{ figure: string; name: string } | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!initialHero) return;
    if (MAGICAL_NAME_CHIPS.includes(initialHero)) { setSelectedCard("magical"); setMagicChip(initialHero); }
    else { setSelectedCard("own"); setTextVal(initialHero); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // needsCheck: only freely-typed text (own name / stranger name) goes through
  // Gemini — curated picks (magical chip, surprise) are already vetted content.
  const doConfirm = async (displayName: string, heroStr: string, needsCheck: boolean) => {
    if (!displayName.trim()) { setValidationError(luna.emptyError); return; }
    if (needsCheck) {
      setValidating(true);
      const result = await validateWizardText(displayName, "heroName", language);
      setValidating(false);
      if (!result.approved) { setValidationError(result.reason || ui.pleaseRephrase); return; }
    }
    setTransitionMsg(luna.q1Confirm);
    setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(heroStr.trim()); }, 1500);
  };

  const handleSurprise = () => {
    const hero = pickRandom(SURPRISE_HEROES);
    setSurpriseHero(hero);
    setSelectedCard("surprise");
  };

  // Runs the AI "is this really an animal?" check for the "+" chip's free
  // text — on success it becomes a selectable chip alongside the built-in
  // animal types, with its own AI-suggested names.
  const checkCustomAnimal = async () => {
    const val = customAnimalText.trim();
    if (!val || customAnimalChecking) return;
    setCustomAnimalChecking(true);
    setCustomAnimalError("");
    try {
      const res = await fetch("/api/validate-animal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: val, language }),
      });
      const data = await res.json() as { approved: boolean; reason?: string; animalEnglish?: string; emoji?: string; names?: string[] };
      if (!data.approved) { setCustomAnimalError(data.reason || ui.pleaseRephrase); return; }
      setCustomAnimal({
        label: val,
        englishId: data.animalEnglish || val.toLowerCase(),
        emoji: data.emoji || "🐾",
        names: data.names?.length ? data.names : ["Rex", "Buddy", "Max", "Bella"],
      });
      setAnimalType(null);
      setShowCustomAnimalInput(false);
      setTextVal("");
      setValidationError("");
    } catch {
      setCustomAnimalError(ui.pleaseRephrase);
    } finally {
      setCustomAnimalChecking(false);
    }
  };

  const canConfirm = (() => {
    if (selectedCard === "own")     return childName ? true : !!textVal.trim();
    if (selectedCard === "magical") return !!magicChip;
    if (selectedCard === "stranger") return !!textVal.trim();
    if (selectedCard === "familyFriend") return !!textVal.trim();
    if (selectedCard === "animal") return (!!animalType || !!customAnimal) && !!textVal.trim();
    if (selectedCard === "surprise") return !!surpriseHero;
    return false;
  })();

  const handleConfirm = () => {
    if (!selectedCard) return;
    if (selectedCard === "own")     return doConfirm(childName || textVal, childName || textVal, !childName);
    if (selectedCard === "magical") return magicChip && doConfirm(magicChip, magicChip, false);
    if (selectedCard === "stranger") return doConfirm(textVal, textVal, true);
    if (selectedCard === "familyFriend") return doConfirm(textVal, textVal, true);
    if (selectedCard === "animal" && (animalType || customAnimal)) {
      const animalWord = customAnimal ? customAnimal.englishId : animalType;
      return doConfirm(textVal, `a brave ${animalWord} named ${textVal.trim()}`, true);
    }
    if (selectedCard === "surprise" && surpriseHero) {
      return doConfirm(surpriseHero.name, `${surpriseHero.figure} named ${surpriseHero.name}`, false);
    }
  };

  // Real siblings first (most personal), then a couple of localized family
  // relation words, then a couple of friend-style names — same source data
  // Q3's "family" companion type already uses, just recombined for a hero
  // who can be a known person rather than a fresh companion.
  const familyFriendChips = (() => {
    const familyWords = companionTypes.find((t) => t.id === "family")?.surpriseNames ?? [];
    const friendNames = companionTypes.find((t) => t.id === "friend")?.surpriseNames ?? [];
    const ownName = childName?.trim().toLowerCase();
    return [...siblingNames, ...familyWords.slice(0, 2), ...friendNames.slice(0, 2)]
      .filter((n) => n.trim().toLowerCase() !== ownName)
      .slice(0, 4);
  })();

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <FairyFigure size={80} />
      <p className="text-white text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} lunaText={luna.q1} audioUrl={audioUrl} ui={ui}>
      <div className="flex flex-col gap-3">

        <div className="grid grid-cols-2 gap-2">
          <IllustratedCard
            label={childName || ui.yourOwnName}
            emoji="👤"
            imageUrl={childAvatarUrl || optionImages["hero-own"]}
            selected={selectedCard === "own"}
            onClick={() => setSelectedCard("own")}
          />
          <IllustratedCard label={ui.aMagicalName}   emoji="✨"  imageUrl={optionImages["hero-magical"]}  selected={selectedCard === "magical"}  onClick={() => setSelectedCard("magical")} />
          <IllustratedCard label={ui.aBraveStranger} emoji="🗺️" imageUrl={optionImages["hero-stranger"]} selected={selectedCard === "stranger"} onClick={() => setSelectedCard("stranger")} />
          <IllustratedCard label={ui.aFamilyMemberOrFriend} emoji="👪" imageUrl={optionImages["hero-familyFriend"]} selected={selectedCard === "familyFriend"} onClick={() => { setSelectedCard("familyFriend"); setTextVal(""); setValidationError(""); }} />
          <IllustratedCard label={ui.aBraveAnimal} emoji="🐾" imageUrl={optionImages["hero-animal"]} selected={selectedCard === "animal"} onClick={() => { setSelectedCard("animal"); setAnimalType(null); setCustomAnimal(null); setShowCustomAnimalInput(false); setCustomAnimalText(""); setCustomAnimalError(""); setTextVal(""); setValidationError(""); }} />
        </div>

        <OptionPill label={ui.surpriseMe} emoji="🎲" selected={selectedCard === "surprise"} onClick={handleSurprise} />

        {selectedCard === "own" && !childName && (
          <>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={luna.q1TextOwn} autoFocus onSubmit={handleConfirm} />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            <ExampleChips examples={["Finn", "Zara", "Milo", "Wren"]} onTap={(v) => { setTextVal(v); setValidationError(""); }} />
          </>
        )}

        {selectedCard === "familyFriend" && (
          <>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={luna.q1TextFamilyFriend} autoFocus onSubmit={handleConfirm} />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            {familyFriendChips.length > 0 && (
              <ExampleChips examples={familyFriendChips} onTap={(v) => { setTextVal(v); setValidationError(""); }} />
            )}
          </>
        )}

        {selectedCard === "animal" && (
          <>
            <div className="flex flex-wrap gap-2">
              <AnimalTypeChips
                animalTypes={animalTypes}
                selected={animalType}
                onSelect={(id) => { setAnimalType(id); setCustomAnimal(null); setShowCustomAnimalInput(false); setTextVal(""); setValidationError(""); }}
              />
              {customAnimal && (
                <button
                  onClick={() => { setShowCustomAnimalInput(true); setCustomAnimalText(customAnimal.label); setCustomAnimalError(""); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                  style={{ background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }}
                >
                  <span className="text-fs-heading">{customAnimal.emoji}</span>
                  <span>{customAnimal.label}</span>
                </button>
              )}
              {!customAnimal && (
                <button
                  onClick={() => { setShowCustomAnimalInput(true); setAnimalType(null); setCustomAnimalText(""); setCustomAnimalError(""); }}
                  title={ui.addYourOwnAnimal}
                  aria-label={ui.addYourOwnAnimal}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-fs-body font-bold transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.5)" }}
                >
                  +
                </button>
              )}
            </div>

            {showCustomAnimalInput && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={customAnimalText}
                    onChange={(e) => { setCustomAnimalText(e.target.value); setCustomAnimalError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); checkCustomAnimal(); } }}
                    placeholder={luna.q1TextCustomAnimal}
                    autoFocus
                    className="flex-1 px-4 py-2.5 rounded-xl outline-none text-fs-body"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                  />
                  <button
                    onClick={checkCustomAnimal}
                    disabled={!customAnimalText.trim() || customAnimalChecking}
                    className="px-4 py-2.5 rounded-xl text-fs-body font-semibold whitespace-nowrap transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }}
                  >
                    {customAnimalChecking ? ui.checkingAnswer : ui.checkAnimal}
                  </button>
                </div>
                {customAnimalError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{customAnimalError}</p>}
              </div>
            )}

            {(animalType || customAnimal) && (
              <>
                <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={luna.q1TextAnimal} autoFocus onSubmit={handleConfirm} />
                {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
                <ExampleChips
                  examples={customAnimal ? customAnimal.names : (animalTypes.find((a) => a.id === animalType)?.names ?? [])}
                  onTap={(v) => { setTextVal(v); setValidationError(""); }}
                />
              </>
            )}
          </>
        )}

        {selectedCard === "magical" && (
          <div className="flex flex-wrap gap-2">
            {MAGICAL_NAME_CHIPS.map((n) => (
              <button key={n} onClick={() => setMagicChip(n)}
                className="px-4 py-2 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                style={magicChip === n
                  ? { background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                {n}
              </button>
            ))}
          </div>
        )}

        {selectedCard === "stranger" && (
          <>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={luna.q1TextStranger} autoFocus onSubmit={handleConfirm} />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            <ExampleChips examples={["Ember the fox", "Sir Bravely", "Captain Nimbus"]} onTap={(v) => { setTextVal(v); setValidationError(""); }} />
          </>
        )}

        {selectedCard === "surprise" && surpriseHero && (
          <div className="rounded-2xl px-5 py-4 text-center"
            style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)" }}>
            <p className="text-white/40 text-fs-body mb-0.5">{ui.yourHeroIs}</p>
            <p className="text-white text-fs-title font-bold" style={{ color: "#4fc3f7" }}>{surpriseHero.name}</p>
            <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.38)", fontStyle: "italic" }}>{surpriseHero.figure}</p>
            <button onClick={handleSurprise} className="text-white/48 text-fs-body mt-3 block w-full">{ui.tryAnother}</button>
          </div>
        )}

        <ConfirmRow
          confirmLabel={validating ? ui.checkingAnswer : ui.thisIsMyHero}
          onConfirm={handleConfirm}
          disabled={!canConfirm || !selectedCard || validating || !!validationError}
          onSkip={onSkip}
          skipLabel={ui.skip}
        />

      </div>
    </QuestionShell>
  );
}

// ─── Q2 — Story world ─────────────────────────────────────────────────────────────────────────

function Q2View({ initialWorld, onNext, onBack, onSkip, onReset, optionImages, audioUrl, luna, ui, worldOptions, language }: { initialWorld: string; onNext: (world: string) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string; luna: LunaCopy; ui: WizardUiCopy; worldOptions: WorldOptionMeta[]; language: string }) {
  const isCardValue = worldOptions.some((w) => w.label === initialWorld);
  const [selected, setSelected]     = useState(isCardValue ? initialWorld : "");
  const [customText, setCustomText] = useState(isCardValue ? "" : initialWorld);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");
  const [validating, setValidating] = useState(false);

  // Custom text isn't pre-vetted like the illustrated cards, so it goes
  // through the same Gemini check as any other free-typed wizard answer.
  const confirm = async (world: string, needsCheck: boolean) => {
    if (!world.trim()) return;
    if (needsCheck) {
      setValidating(true);
      const result = await validateWizardText(world, "world", language);
      setValidating(false);
      if (!result.approved) { setValidationError(result.reason || ui.pleaseRephrase); return; }
    }
    setTransitionMsg(luna.q2Confirm(world)); setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(world); }, 1500);
  };

  const current = customText.trim() || selected;
  const handleConfirm = () => { if (current) confirm(current, !!customText.trim()); };

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <FairyFigure size={80} />
      <p className="text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} lunaText={luna.q2} audioUrl={audioUrl} ui={ui}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {worldOptions.map((w) => {
            const isSel = selected === w.label;
            return (
              <IllustratedCard
                key={w.id}
                label={w.label}
                emoji={w.emoji}
                imageUrl={optionImages[`world-${w.id}`]}
                selected={isSel}
                onClick={() => { setSelected(w.label); setCustomText(""); setValidationError(""); }}
              />
            );
          })}
        </div>
        <p className="text-fs-body text-center" style={{ color: "rgba(255,255,255,0.52)" }}>{ui.orDescribeWorld}</p>
        <StoryInput
          value={customText}
          onChange={(v) => { setCustomText(v); setSelected(""); setValidationError(""); }}
          placeholder={ui.describeYourWorld}
          onSubmit={handleConfirm}
        />
        {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
        <ConfirmRow
          confirmLabel={validating ? ui.checkingAnswer : ui.thisIsTheWorld}
          onConfirm={handleConfirm}
          disabled={!current || validating || !!validationError}
          onSkip={onSkip}
          skipLabel={ui.skip}
        />
      </div>
    </QuestionShell>
  );
}

// ─── Q3 — Companion ──────────────────────────────────────────────────────────────────────────────

function Q3View({ heroName, worldName, initialCompanion, onNext, onBack, onSkip, onReset, optionImages, audioUrl, luna, ui, companionTypes, language, siblingNames, animalTypes, childName }: { heroName: string; worldName: string; initialCompanion: string; onNext: (c: string) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string; luna: LunaCopy; ui: WizardUiCopy; companionTypes: CompanionTypeMeta[]; language: string; siblingNames: string[]; animalTypes: AnimalTypeMeta[]; childName?: string }) {
  const [selectedType, setSelectedType] = useState<Q3CompanionTypeId | null>(null);
  const [nameVal, setNameVal]           = useState("");
  const [animalType, setAnimalType]     = useState<AnimalTypeId | null>(null);
  const [validationError, setValidationError] = useState("");
  const [validating, setValidating]     = useState(false);

  // Restore prior selection when editing from summary
  useEffect(() => {
    if (!initialCompanion) return;
    // "a dog named Rex" (pet + species) — check before the generic geminiLabel
    // match below, since "pet"'s own geminiLabel ("pet") never appears in this
    // format once a species has been picked.
    for (const a of animalTypes) {
      const withName = `a brave ${a.id} named `;
      if (initialCompanion.startsWith(withName)) {
        setSelectedType("pet");
        setAnimalType(a.id);
        setNameVal(initialCompanion.slice(withName.length));
        return;
      }
    }
    for (const ct of companionTypes) {
      const withName = `a ${ct.geminiLabel} named `;
      if (initialCompanion.startsWith(withName)) {
        setSelectedType(ct.id);
        setNameVal(initialCompanion.slice(withName.length));
        return;
      }
      if (initialCompanion === `a ${ct.geminiLabel}`) {
        setSelectedType(ct.id);
        return;
      }
    }
  }, [initialCompanion, companionTypes, animalTypes]);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const [transitioning, setTransitioning]   = useState(false);
  const [transitionMsg, setTransitionMsg]   = useState("");

  const buildCompanionString = (type: Q3CompanionTypeId, name: string): string => {
    // A pet with a chosen species reads as "a dog named Rex", not the generic
    // "a pet named Rex" — same species-aware phrasing Q1's animal hero uses.
    if (type === "pet" && animalType) {
      return name.trim() ? `a brave ${animalType} named ${name.trim()}` : `a brave ${animalType}`;
    }
    const ct = companionTypes.find((t) => t.id === type)!;
    return name.trim() ? `a ${ct.geminiLabel} named ${name.trim()}` : `a ${ct.geminiLabel}`;
  };

  const confirm = async (type: Q3CompanionTypeId, name: string) => {
    if (name.trim()) {
      setValidating(true);
      const result = await validateWizardText(name.trim(), "companionName", language);
      setValidating(false);
      if (!result.approved) { setValidationError(result.reason || ui.pleaseRephrase); return; }
    }
    const companion = buildCompanionString(type, name);
    const displayLabel = type === "pet" && animalType
      ? animalTypes.find((a) => a.id === animalType)!.label
      : companionTypes.find((t) => t.id === type)!.label;
    setTransitionMsg(luna.q3Confirm(name.trim() || displayLabel));
    setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(companion); }, 1500);
  };

  // Load contextual name suggestions when companion type (or, for pet, the
  // chosen species) changes.
  useEffect(() => {
    if (!selectedType) { setSuggestedNames([]); return; }
    const ct = companionTypes.find((t) => t.id === selectedType)!;

    // "Family member" chips should be real relationships (and real siblings,
    // when this family has other children) — the generic AI name-suggestion
    // call below is tuned for invented character names and was surfacing
    // whimsical/pet-sounding names for this category, not relations.
    if (selectedType === "family") {
      const ownName = childName?.trim().toLowerCase();
      setSuggestedNames(
        [...siblingNames, ...ct.surpriseNames].filter((n) => n.trim().toLowerCase() !== ownName).slice(0, 4)
      );
      return;
    }

    // "Pet" shows a species picker first (AnimalTypeChips, rendered below) —
    // name suggestions only make sense once a species is chosen, and then
    // they're that species' own names, not a generic AI guess.
    if (selectedType === "pet") {
      setSuggestedNames(animalType ? (animalTypes.find((a) => a.id === animalType)?.names ?? []) : []);
      return;
    }

    // Show hardcoded names immediately
    setSuggestedNames(ct.surpriseNames.slice(0, 4));
    // Try to get AI-generated contextual names
    let cancelled = false;
    fetch("/api/suggest-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionType: selectedType, heroName, worldName }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { names?: string[] } | null) => {
        if (!cancelled && data?.names?.length) setSuggestedNames(data.names.slice(0, 4));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedType, heroName, worldName, companionTypes, siblingNames, animalType, animalTypes, childName]);

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <FairyFigure size={80} />
      <p className="text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} lunaText={luna.q3(worldName)} audioUrl={audioUrl} ui={ui}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {companionTypes.map((ct) => (
            <IllustratedCard
              key={ct.id}
              label={ct.label}
              emoji={ct.emoji}
              imageUrl={optionImages[`companion-${ct.id}`]}
              selected={selectedType === ct.id}
              onClick={() => { setSelectedType(ct.id); setNameVal(""); setAnimalType(null); setValidationError(""); }}
            />
          ))}
        </div>

        {selectedType === "pet" && (
          <div className="flex flex-wrap gap-2">
            <AnimalTypeChips
              animalTypes={animalTypes}
              selected={animalType}
              onSelect={(id) => { setAnimalType(id); setNameVal(""); setValidationError(""); }}
            />
          </div>
        )}

        {selectedType && (selectedType !== "pet" || animalType) && (
          <>
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
              {ui.companionNameHint}
            </p>
            <input
              autoFocus
              type="text"
              value={nameVal}
              onChange={(e) => { setNameVal(e.target.value); setValidationError(""); }}
              onKeyDown={(e) => e.key === "Enter" && confirm(selectedType, nameVal)}
              placeholder={ui.namePlaceholder}
              className="w-full rounded-xl px-4 py-3 text-fs-body text-white placeholder-white/25 outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            {suggestedNames.length > 0 && (
              <ExampleChips examples={suggestedNames} onTap={(v) => { setNameVal(v); setValidationError(""); }} />
            )}
          </>
        )}

        {!selectedType && (
          <p className="text-fs-body text-center" style={{ color: "rgba(255,255,255,0.52)" }}>{luna.q3Nudge}</p>
        )}

        <ConfirmRow
          confirmLabel={validating ? ui.checkingAnswer : ui.thisIsTheCompanion}
          onConfirm={() => selectedType && confirm(selectedType, nameVal)}
          disabled={!selectedType || (selectedType === "pet" && !animalType) || validating || !!validationError}
          onSkip={onSkip}
          skipLabel={ui.skip}
        />
      </div>
    </QuestionShell>
  );
}

// ─── Q4 — Dramatic engine ───────────────────────────────────────────────────────────────────

type Q4Phase = "input" | "reaction1" | "reaction2";

function Q4View({ heroName, companionName, initialEngine, onNext, onBack, onSkip, onReset, optionImages, audioUrl, luna, ui, q4Categories, language }: { heroName: string; companionName: string; initialEngine: string; onNext: (e: string) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string; luna: LunaCopy; ui: WizardUiCopy; q4Categories: Q4CategoryMeta[]; language: string }) {
  const [selectedCat, setSelectedCat] = useState<Q4CategoryId | null>(null);
  const [textVal, setTextVal]         = useState(initialEngine);
  const [phase, setPhase]             = useState<Q4Phase>("input");
  const [confirmedEngine, setConfirmedEngine] = useState("");
  const [validationError, setValidationError] = useState("");
  const [validating, setValidating]   = useState(false);

  useEffect(() => {
    if (initialEngine) { setSelectedCat("funny"); setTextVal(initialEngine); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCat = q4Categories.find((c) => c.id === selectedCat);

  // Leaving the field blank is a valid path, same as Q3's companion name —
  // Luna picks one of the current category's own example prompts instead of
  // erroring. Only the user's own typed text needs the Gemini check; a
  // pre-vetted example never does.
  const confirm = async (engine: string) => {
    const finalEngine = engine.trim() || (activeCat ? pickRandom(activeCat.examples) : "");
    if (!finalEngine) { setValidationError(luna.emptyError); return; }
    if (engine.trim()) {
      setValidating(true);
      const result = await validateWizardText(finalEngine, "challenge", language);
      setValidating(false);
      if (!result.approved) { setValidationError(result.reason || ui.pleaseRephrase); return; }
    }
    setConfirmedEngine(finalEngine);
    setTimeout(() => setPhase("reaction1"), 1500);
  };

  if (phase === "reaction1") return (
    <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
      <FairyFigure size={72} />
      <LunaLine text={luna.q4Reaction1} speed={90} onComplete={() => setTimeout(() => setPhase("reaction2"), 600)} />
    </div>
  );

  if (phase === "reaction2") return (
    <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
      <FairyFigure size={72} />
      <p className="text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{luna.q4Confirm(confirmedEngine)}</p>
      <AutoAdvance delay={1200} onAdvance={() => onNext(confirmedEngine)} />
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} lunaText={luna.q4(companionName)} audioUrl={audioUrl} ui={ui}>
      <div className="flex flex-col gap-3">

        <div className="grid grid-cols-2 gap-2">
          {q4Categories.map((c) => (
            <IllustratedCard
              key={c.id}
              label={c.label}
              emoji={c.emoji}
              imageUrl={optionImages[`engine-${c.id}`]}
              selected={selectedCat === c.id}
              onClick={() => { setSelectedCat(c.id); setTextVal(""); setValidationError(""); }}
            />
          ))}
        </div>

        {selectedCat && activeCat && (
          <>
            <StoryInput value={textVal}
              onChange={(v) => { setTextVal(v); setValidationError(""); }}
              placeholder={activeCat.placeholder}
              maxSoftLimit={80}
              autoFocus
              onSubmit={() => confirm(textVal)}
              overLimitText={luna.q4Hint} />
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
              {ui.challengeHint}
            </p>
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            <ExampleChips
              examples={activeCat.examples}
              onTap={(v) => { setTextVal(v); setValidationError(""); }}
            />
            <ConfirmRow
              confirmLabel={validating ? ui.checkingAnswer : ui.thisIsTheChallenge}
              onConfirm={() => confirm(textVal)}
              disabled={validating || !!validationError}
              onSkip={onSkip}
              skipLabel={ui.skip}
            />
          </>
        )}

        {/* Before a category is picked, "Surprise me" and "Skip" used to be two
            separate buttons doing almost the same thing (fill something random,
            one letting you preview it first) — merged into one that just
            commits to a random pick and moves straight on, same as onSkip
            already did under the hood. */}
        {!selectedCat && onSkip && (
          <OptionPill label={ui.surpriseMe} emoji="🎲" onClick={onSkip} />
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q5 — Resolution mood ───────────────────────────────────────────────────────────────────────

function Q5View({ engineText, initialMood, onNext, onBack, onSkip, onReset, optionImages, audioUrl, luna, ui, moodLabels }: { engineText: string; initialMood?: ResolutionMood | null; onNext: (mood: ResolutionMood) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string; luna: LunaCopy; ui: WizardUiCopy; moodLabels: Record<string, string> }) {
  const MOODS: { id: ResolutionMood; emoji: string; isBedtime?: boolean }[] = [
    { id: "brave",     emoji: "🦱" },
    { id: "laughing",  emoji: "😂" },
    { id: "surprised", emoji: "🌟" },
    { id: "sleepy",    emoji: "🌙", isBedtime: true },
  ];

  const [selectedMood, setSelectedMood] = useState<ResolutionMood | null>(initialMood ?? null);

  return (
    <QuestionShell onBack={onBack} onReset={onReset} lunaText={luna.q5(engineText)} audioUrl={audioUrl} ui={ui}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          {MOODS.map((m) => (
            <IllustratedCard
              key={m.id}
              label={moodLabels[m.id]}
              emoji={m.emoji}
              imageUrl={optionImages[`mood-${m.id}`]}
              selected={selectedMood === m.id}
              onClick={() => setSelectedMood(m.id)}
              badge={m.isBedtime
                ? <span className="block text-fs-body font-bold uppercase tracking-widest mb-0.5" style={{ color: "#FBB824" }}>{ui.bedtimeBadge}</span>
                : undefined
              }
            />
          ))}
        </div>
        {selectedMood ? (
          <>
            <OptionPill label={ui.surpriseMe} emoji="🎲" onClick={() => setSelectedMood(pickRandom(MOODS).id)} />
            <ConfirmRow
              confirmLabel={ui.thisIsTheEnding}
              onConfirm={() => onNext(selectedMood)}
              onSkip={onSkip}
              skipLabel={ui.skip}
            />
          </>
        ) : (
          // Before a mood is picked, "Surprise me" and "Skip" used to be two
          // separate buttons doing almost the same thing — merged into one
          // that commits to a random mood AND (this being the last question)
          // jumps straight into generation, same as onSkip already does.
          onSkip && <OptionPill label={ui.surpriseMe} emoji="🎲" onClick={onSkip} />
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Summary screen ────────────────────────────────────────────────────────────────────────────────

type SummaryPhase = "table" | "script" | "countdown" | "herewego";

function SummaryView({ answers, durationMinutes, onDurationChange, onEditStep, onLaunch, onReset, luna, ui, moodLabels, companionTypes, animalTypes, audioUrl }: {
  answers: Answers;
  durationMinutes: number;
  onDurationChange: (v: number) => void;
  onEditStep: (step: Step) => void;
  onLaunch: () => void;
  onReset?: () => void;
  luna: LunaCopy;
  ui: WizardUiCopy;
  moodLabels: Record<string, string>;
  companionTypes: CompanionTypeMeta[];
  animalTypes: AnimalTypeMeta[];
  audioUrl?: string;
}) {
  const [phase, setPhase] = useState<SummaryPhase>("table");
  const [showReady, setShowReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); audioRef.current = null; };
  }, [audioUrl]);

  const moodLabel = answers.q5_mood ? moodLabels[answers.q5_mood] : "";
  // answers.q1_hero / q3_companion can be built from English proper-noun
  // patterns (an animal species, a companion's geminiLabel) meant for the
  // story-generation prompt — re-localize them for anything the user sees.
  const displayHero = localizeHeroForDisplay(answers.q1_hero, ui, animalTypes);
  const displayCompanion = localizeCompanionForDisplay(answers.q3_companion, companionTypes, ui, animalTypes);
  const launchScript = luna.launch(moodLabel, displayCompanion, answers.q2_world, answers.q4_engine);

  const ROWS: { label: string; value: string; step: Step }[] = [
    { label: ui.hero,      value: displayHero,       step: "q1" },
    { label: ui.world,     value: answers.q2_world,  step: "q2" },
    { label: ui.companion, value: displayCompanion,  step: "q3" },
    { label: ui.challenge, value: answers.q4_engine, step: "q4" },
    { label: ui.ending,    value: moodLabel,         step: "q5" },
  ];

  const handleCountdownDone = useCallback(() => {
    setPhase("herewego");
    setTimeout(onLaunch, 1500);
  }, [onLaunch]);

  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-8">
        <BackButton onClick={() => onEditStep("q5")} />
        <div className="flex-1 flex justify-center"><FairyFigure size={52} /></div>
        {onReset ? (
          <button onClick={onReset}
            className="text-fs-body py-1.5 px-3 rounded-xl transition-all active:scale-95"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}>
            {ui.startOver}
          </button>
        ) : <div className="w-16" />}
      </div>

      {phase === "table" && (
        <div className="mb-7">
          <LunaLine text={luna.summaryReady} />
        </div>
      )}

      <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {ROWS.map((row, i) => (
          <div key={row.label} className="flex items-center px-4 py-3 gap-3"
            style={{ borderBottom: i < ROWS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.52)" }}>{row.label}</span>
              <span className="text-fs-body text-white/80 truncate">{row.value}</span>
            </div>
            <button onClick={() => onEditStep(row.step)}
              className="text-fs-body px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{ background: "rgba(79,195,247,0.08)", color: "rgba(79,195,247,0.7)", border: "1px solid rgba(79,195,247,0.2)" }}>
              {ui.edit}
            </button>
          </div>
        ))}
      </div>

      {phase === "table" && (
        <div className="mb-5">
          <label className="text-white/40 text-fs-body font-bold uppercase tracking-widest mb-3 block">{ui.storyLength}</label>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { value: 3, icon: "⚡", label: ui.short },
              { value: 5, icon: "🌙", label: ui.medium },
              { value: 8, icon: "✨", label: ui.long },
            ].map((p) => {
              const sel = durationMinutes === p.value;
              return (
                <button key={p.value} onClick={() => onDurationChange(p.value)}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl transition-all active:scale-[0.97]"
                  style={sel
                    ? { background: "rgba(79,195,247,0.14)", border: "1px solid rgba(79,195,247,0.5)", color: "#4fc3f7" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  <span className="text-fs-body">{p.icon}</span>
                  <span className="text-fs-body font-semibold">{p.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-center mb-1.5">
            <span className="text-fs-body font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(79,195,247,0.12)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.25)" }}>
              {durationMinutes} min
            </span>
          </div>
          <input type="range" min={1} max={10} step={1} value={durationMinutes}
            onChange={(e) => onDurationChange(+e.target.value)}
            className="w-full cursor-pointer" style={{ accentColor: "#4fc3f7" }} />
          <div className="flex justify-between text-white/40 text-fs-body mt-1">
            <span>1 min</span>
            <span className="text-white/35">· · · · · · · · ·</span>
            <span>10 min</span>
          </div>
        </div>
      )}

      {phase === "table" && (
        <button
          onClick={() => setPhase("script")}
          className="w-full py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }}>
          {ui.readyToHearStory}
        </button>
      )}

      {(phase === "script" || phase === "countdown" || phase === "herewego") && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-fs-body font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.6)" }}>{ui.lunaLabel}</p>
            <LunaLine text={launchScript} speed={65}
              onComplete={() => { setShowReady(true); setTimeout(() => setPhase("countdown"), 600); }} />
          </div>
          {showReady && phase !== "herewego" && (
            <p className="text-white/60 text-fs-body italic text-center">{ui.areYouReady}</p>
          )}
          {phase === "countdown" && <LaunchCountdown onComplete={handleCountdownDone} />}
          {phase === "herewego" && (
            <p className="text-center text-fs-heading font-semibold" style={{ color: "#4fc3f7" }}>{luna.hereWeGo}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generating screen ────────────────────────────────────────────────────────────────────────

function GeneratingView({ worldName, seeds, durationMinutes, contentLanguage, lessons, childContext, onDone, onError, luna }: {
  worldName: string;
  seeds: StorySeeds; durationMinutes: number;
  contentLanguage?: string;
  lessons?: string[];
  childContext?: {
    childAgeGroup?: string; avoid?: string; gender?: "boy" | "girl" | "other";
    favoriteThemes?: string[]; favoriteAnimals?: string[]; preferredFigures?: string[];
    interests?: string; notes?: string; childName?: string;
  };
  onDone: (blocks: ScriptBlock[], summary: string, coverPrompt: string, characters?: Record<string, StoryCharacterInfo>, scenes?: import("@/types").StoryScene[], title?: string) => void;
  onError: (msg: string) => void;
  luna: LunaCopy;
}) {
  const messages = luna.generating(worldName);
  const [msgIdx, setMsgIdx] = useState(0);
  const [showLong, setShowLong] = useState(false);
  const onDoneRef  = useRef(onDone);
  const onErrorRef = useRef(onError);
  onDoneRef.current  = onDone;
  onErrorRef.current = onError;

  useEffect(() => {
    const msgId  = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 3000);
    const longId = setTimeout(() => setShowLong(true), 20_000);
    const controller = new AbortController();

    fetch("/api/five-question-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seeds, durationMinutes, language: contentLanguage, narratorVoiceId: getNarratorVoiceId(), lessons, ...childContext }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        onDoneRef.current(data.blocks as ScriptBlock[], data.summary ?? "", data.coverPrompt ?? "", data.characters as Record<string, StoryCharacterInfo> | undefined, data.scenes as import("@/types").StoryScene[] | undefined, data.title ?? "");
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        onErrorRef.current(err instanceof Error ? err.message : String(err));
      });

    return () => { controller.abort(); clearInterval(msgId); clearTimeout(longId); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-8" style={{ background: "transparent" }}>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping opacity-10" style={{ background: "radial-gradient(circle, rgba(236,72,153,0.6), rgba(79,195,247,0.3))" }} />
        <div className="absolute inset-4 rounded-full opacity-25 animate-pulse" style={{ background: "radial-gradient(circle, rgba(167,139,250,0.6), rgba(236,72,153,0.3))" }} />
        <div className="relative z-10"><FairyFigure size={100} roll /></div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-white text-fs-heading font-medium">{messages[msgIdx]}</p>
        {showLong && <p className="text-white/40 text-fs-body">{luna.generatingLong}</p>}
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full"
            style={{ background: "linear-gradient(135deg,#4fc3f7,#0088AA)", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────────────────────────

const INITIAL_ANSWERS: Answers = { q1_hero: "", q2_world: "", q3_companion: "", q4_engine: "", q5_mood: null };

export interface StoryCharacterInfo { type: "child" | "adult" | "animal" | "narrator"; visualDescription: string; }
export type FiveQuestionCompleteData = { blocks: ScriptBlock[]; summary: string; coverPrompt: string; characters?: Record<string, StoryCharacterInfo>; scenes?: import("@/types").StoryScene[]; storyTitle?: string };

export function FiveQuestionFlow({ onComplete, onGenerating, childName, childAvatarUrl, childId, contentLanguage, showInternalReset = true, onFirstAnswer }: { onComplete?: (data: FiveQuestionCompleteData) => void; onGenerating?: () => void; childName?: string; childAvatarUrl?: string; /** Active child's profile id — used to look up real siblings (other children in the same family) for Q3's "family member" chips. */ childId?: string; /** Story content language — independent of the app's global UI language. Falls back to it when not provided. */ contentLanguage?: string; /** Set false when an outer page already renders its own reset+language bar (e.g. Studio), to avoid duplicating the "Start over" button on every question and the summary screen. */ showInternalReset?: boolean; /** Fires once, the first time the user makes real progress (leaves q1 with no answers) — lets an outer page lock its own language selector for the rest of the journey. */ onFirstAnswer?: () => void } = {}) {
  const router = useRouter();
  const { language, t } = useLanguage();
  // Governs the entire wizard's visible/spoken text — narration, card
  // labels, buttons, and the final story — independent of the app's own
  // global UI language.
  const effectiveLanguage = contentLanguage ?? language;
  const luna = useMemo(() => getLuna(effectiveLanguage), [effectiveLanguage]);
  const ui = useMemo(() => getWizardUi(effectiveLanguage), [effectiveLanguage]);
  const moodLabels = useMemo(() => getMoodLabels(effectiveLanguage), [effectiveLanguage]);
  const worldOptions = useMemo(() => getWorldOptions(effectiveLanguage), [effectiveLanguage]);
  const companionTypes = useMemo(() => getCompanionTypes(effectiveLanguage), [effectiveLanguage]);
  const q4Categories = useMemo(() => getQ4Categories(effectiveLanguage), [effectiveLanguage]);
  const animalTypes = useMemo(() => getAnimalTypes(effectiveLanguage), [effectiveLanguage]);

  // Real siblings (other children in this family) for Q3's "family member"
  // chips — fetched once, best-effort. Empty when there's no other child
  // profile (or none at all), which is the common case and handled fine by
  // Q3View's relation-word fallback chips (Mom/Dad/Grandpa/Grandma/...).
  const [siblingNames, setSiblingNames] = useState<string[]>([]);
  // The active child's own default moral lessons (Profile > Edit / onboarding)
  // — pre-applied to the generated story so the wizard never has to ask.
  const [defaultLessons, setDefaultLessons] = useState<string[]>([]);
  // Rest of the active child's profile — age (for language-level targeting),
  // avoid (fears/sensitivities), and the lighter personalization fields
  // (gender, themes, favorite animals, preferred figures, interests, notes).
  // This route previously never read any of this, so the wizard's generated
  // stories ignored the whole profile beyond the name typed into Q1.
  const [childContext, setChildContext] = useState<{
    childAgeGroup?: string; avoid?: string; gender?: "boy" | "girl" | "other";
    favoriteThemes?: string[]; favoriteAnimals?: string[]; preferredFigures?: string[];
    interests?: string; notes?: string; childName?: string;
  }>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/child-profiles", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((profiles: {
        id: string; name: string; age?: number; gender?: "boy" | "girl" | "other";
        default_moral_lessons?: string[]; avoid?: string; favorite_themes?: string[];
        favorite_animals?: string[]; preferred_figures?: string[]; interests?: string; notes?: string;
      }[]) => {
        if (cancelled) return;
        const siblings = (profiles ?? []).filter((p) => p.id !== childId && p.name?.trim()).map((p) => p.name.trim());
        setSiblingNames(siblings);
        const self = (profiles ?? []).find((p) => p.id === childId);
        setDefaultLessons(self?.default_moral_lessons ?? []);
        setChildContext({
          childAgeGroup: self?.age != null
            ? (self.age <= 4 ? "2-4" : self.age <= 6 ? "4-6" : self.age <= 8 ? "6-8" : self.age <= 10 ? "8-10" : "10-12")
            : undefined,
          avoid: self?.avoid,
          gender: self?.gender,
          favoriteThemes: self?.favorite_themes,
          favoriteAnimals: self?.favorite_animals,
          preferredFigures: self?.preferred_figures,
          interests: self?.interests,
          notes: self?.notes,
          // Lets the server detect "the hero IS the child" (hero name
          // matches this exactly, which Q1's "your own name" option does by
          // default) to cast the hero's voice/avatar from the real child
          // profile instead of a generic default.
          childName: self?.name,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [childId]);

  const [step, setStep]                   = useState<Step>("q1");
  const [resetToken, setResetToken]       = useState(0);
  const [answers, setAnswers]             = useState<Answers>(INITIAL_ANSWERS);
  const [durationMinutes, setDuration]    = useState(5);
  const [editingFromSummary, setEditingFromSummary] = useState(false);
  const [scriptBlocks, setScriptBlocks]   = useState<ScriptBlock[]>([]);
  const [error, setError]                 = useState<string | null>(null);
  const [isProducing, setIsProducing]     = useState(false);
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]   = useState<Job | null>(null);
  const [summary, setSummary]             = useState("");
  const [coverUrl, setCoverUrl]           = useState("");
  const [coverPrompt, setCoverPrompt]     = useState("");
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [voicePool, setVoicePool] = useState<Voice[]>(PRESET_VOICE_POOL);
  const [optionImages, setOptionImages] = useState<Record<string, string>>({});
  const [imagesGenerating, setImagesGenerating] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step?: Step; answers?: Answers; durationMinutes?: number };
        const hasContent = parsed.answers && Object.values(parsed.answers).some((v) => v);
        if (hasContent && parsed.answers) {
          setAnswers(parsed.answers);
          if (parsed.durationMinutes) setDuration(parsed.durationMinutes);
          const safestep = parsed.step;
          // Never resume straight onto the summary screen — the Story Length
          // panel lives there, and reopening a draft shouldn't drop the user
          // in front of it without re-reaching that step this visit.
          if (safestep && !["generating", "done", "summary"].includes(safestep)) setStep(safestep);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist draft on every step/answer change
  useEffect(() => {
    if (step === "generating" || step === "done") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, answers, durationMinutes }));
    } catch { /* ignore */ }
  }, [step, answers, durationMinutes]);

  const [questionAudios, setQuestionAudios] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchVoicePool().then(setVoicePool);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function seedAudio() {
      // Luna speaks in the user's own chosen default narrator voice —
      // cached per (language, voiceId) so anyone else who picked the same
      // voice shares the cache instead of regenerating it.
      const voiceId = getNarratorVoiceId();
      try {
        const res = await fetch(`/api/admin/seed-bluebell-audio?lang=${effectiveLanguage}&voiceId=${voiceId}`);
        if (!res.ok) return;
        const { missing, existingAudioUrls } = await res.json() as {
          missing: string[];
          existingAudioUrls: Record<string, string>;
        };

        if (existingAudioUrls && Object.keys(existingAudioUrls).length > 0) {
          setQuestionAudios((prev) => ({ ...prev, ...existingAudioUrls }));
        }

        if (!missing?.length) return;

        const ordered = ["q1", "q2", "q3", "q4", "q5", "summary"].filter((k) => missing.includes(k));
        for (const key of ordered) {
          if (cancelled) return;
          try {
            const genRes = await fetch(`/api/admin/seed-bluebell-audio?lang=${effectiveLanguage}&key=${key}&voiceId=${voiceId}`, { method: "POST" });
            if (genRes.ok) {
              const { url } = await genRes.json() as { ok: boolean; key: string; url: string };
              if (url) setQuestionAudios((prev) => ({ ...prev, [key]: url }));
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    setQuestionAudios({});
    seedAudio();
    return () => { cancelled = true; };
  }, [effectiveLanguage]);

  useEffect(() => {
    let cancelled = false;
    async function seedImages() {
      try {
        const res = await fetch("/api/admin/seed-create-images");
        if (!res.ok) { console.warn("[seedImages] GET failed", res.status); setImagesReady(true); return; }
        const { missing, existingImageUrls } = await res.json() as {
          missing: { key: string; prompt: string }[];
          existingImageUrls: Record<string, string>;
        };

        if (existingImageUrls && Object.keys(existingImageUrls).length > 0) {
          setOptionImages((prev) => ({ ...prev, ...existingImageUrls }));
        }
        // Every already-cached image URL is known at this point — safe to
        // reveal the wizard now instead of stepping through cards that each
        // start blank/placeholder and pop in their real art a moment later.
        // Only genuinely never-before-seen images (the `missing` list below)
        // still need to stream in live, and those show a neutral loading
        // skeleton rather than a placeholder that looks like finished art.
        setImagesReady(true);

        if (!missing?.length) { return; }

        setImagesGenerating(true);
        const BATCH = 8;
        for (let i = 0; i < missing.length; i += BATCH) {
          if (cancelled) return;
          const batch = missing.slice(i, i + BATCH).filter(m => m.prompt);
          await Promise.all(batch.map(async ({ key, prompt }) => {
            try {
              const cacheRes = await fetch(`/api/admin/seed-create-images?key=${encodeURIComponent(key)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
              });
              if (cacheRes.ok) {
                const { imageKey, url: cachedUrl } = await cacheRes.json() as { ok: boolean; imageKey: string; url: string };
                if (imageKey && cachedUrl) {
                  setOptionImages((prev) => ({ ...prev, [imageKey]: cachedUrl }));
                }
              } else {
                console.warn("[seedImages] failed:", key, await cacheRes.text().catch(() => ""));
              }
            } catch (e) { console.warn("[seedImages] error:", key, e); }
          }));
        }
        setImagesGenerating(false);
      } catch (e) {
        console.warn("[seedImages] seed error", e);
        setImagesReady(true);
      }
    }
    seedImages();
    return () => { cancelled = true; };
  }, []);

  const setAnswer = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const handleReset = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setStep("q1"); setAnswers(INITIAL_ANSWERS); setDuration(5);
    setScriptBlocks([]); setError(null);
    setIsProducing(false); setProductionJobId(null); setCompletedJob(null);
    setSummary(""); setCoverUrl(""); setCoverPrompt("");
    setEditingFromSummary(false);
    // Force a fresh mount of the active question view even when the step
    // value itself doesn't change (e.g. resetting while already on q1) —
    // otherwise that view's own local state (typed text, selected card)
    // keeps showing the pre-reset selection.
    setResetToken((t) => t + 1);
  };

  const fetchCover = useCallback(async (prompt: string, storySummary?: string) => {
    if (!prompt) return;
    setIsFetchingCover(true);
    try {
      const res = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, summary: storySummary }),
      });
      const data = await res.json();
      if (res.ok && data.coverUrl) {
        setCoverUrl(data.coverUrl);
      } else {
        console.error("[fetchCover] API error:", data);
      }
    } catch (err) {
      console.error("[fetchCover] Fetch error:", err);
    } finally {
      setIsFetchingCover(false);
    }
  }, []);

  const handleBack = () => {
    const order: Step[] = ["q1", "q2", "q3", "q4", "q5", "summary"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
    else handleReset();
  };

  const handleLaunch = useCallback(() => { onGenerating?.(); setStep("generating"); setError(null); }, [onGenerating]);

  const handleDone = useCallback((blocks: ScriptBlock[], incomingSummary: string, incomingCoverPrompt: string, characters?: Record<string, StoryCharacterInfo>, scenes?: import("@/types").StoryScene[], incomingTitle?: string) => {
    setScriptBlocks(blocks);
    setSummary(incomingSummary);
    setCoverPrompt(incomingCoverPrompt);
    setCoverUrl("");
    if (onComplete) {
      writeDraft({ promptText: "", scriptBlocks: blocks, summary: incomingSummary, coverPrompt: incomingCoverPrompt, coverUrl: "", scenes, storyTitle: incomingTitle });
      onComplete({ blocks, summary: incomingSummary, coverPrompt: incomingCoverPrompt, characters, scenes, storyTitle: incomingTitle });
    } else {
      // Standalone (no onComplete) means this flow was reached directly at
      // /create/five-question rather than embedded inside Studio — hand off
      // to Studio via its own draft key (nightstory_draft_v1 is unrelated and
      // never read by /studio), including characterProfiles so nature-based
      // voice casting works immediately instead of only after a later save.
      writeDraft(
        { promptText: "", scriptBlocks: blocks, summary: incomingSummary, coverPrompt: incomingCoverPrompt, coverUrl: "", scenes, characterProfiles: characters, storyTitle: incomingTitle },
        "nightstory_studio2_draft_v1",
      );
      if (incomingCoverPrompt) fetchCover(incomingCoverPrompt, incomingSummary);
      router.push("/studio?tab=script");
    }
  }, [fetchCover, router, onComplete]);

  const handleGenError = useCallback((msg: string) => {
    setError(msg);
    setStep("summary");
  }, []);

  const handleProduce = useCallback(async (blocks: ScriptBlock[], durationMinutes: number) => {
    setIsProducing(true);
    try {
      const produceBody: Record<string, unknown> = { blocks, durationMinutes };
      if (summary) produceBody.summary = summary;
      if (coverPrompt) produceBody.coverPrompt = coverPrompt;
      const coverMatch = coverUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (coverMatch) {
        produceBody.coverImageMimeType = coverMatch[1];
        produceBody.coverImageData = coverMatch[2];
      }
      // Lets the server use the child's real photo for the hero's avatar
      // when the hero represents the child (name match), instead of a
      // generic avatar-bank illustration.
      if (childContext.childName) produceBody.childName = childContext.childName;
      if (childAvatarUrl) produceBody.childAvatarUrl = childAvatarUrl;
      const res  = await fetch("/api/produce-drama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(produceBody) });
      const text = await res.text();
      let data: { jobId?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data.error ?? "Production failed");
      setProductionJobId(data.jobId!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Production failed");
      setIsProducing(false);
    }
  }, [summary, coverPrompt, coverUrl, childContext.childName, childAvatarUrl]);

  const handleProductionDone = useCallback((job: Job) => {
    setCompletedJob(job); setIsProducing(false);
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setError(msg); setIsProducing(false); setProductionJobId(null);
  }, []);

  const seeds: StorySeeds | null = answers.q5_mood
    ? { q1_hero: answers.q1_hero, q2_world: answers.q2_world, q3_companion: answers.q3_companion, q4_engine: answers.q4_engine, q5_mood: answers.q5_mood }
    : null;

  const ErrorBanner = error ? (
    <div className="mx-5 mb-4 px-4 py-3 rounded-2xl text-fs-body"
      style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
      <p>⚠ {luna.apiError}</p>
      <p className="text-fs-body mt-1 opacity-70">{error}</p>
    </div>
  ) : null;

  const GeneratingBadge = imagesGenerating ? (
    <div className="flex items-center justify-center gap-2 py-1.5 mb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-bright animate-pulse" />
      <span className="text-fs-body animate-pulse" style={{ color: "rgba(167,139,250,0.6)" }}>{t("paintingImages")}</span>
    </div>
  ) : null;

  // Whether user has made any progress (for showing Start over button)
  const hasProgress = Object.values(answers).some((v) => v) || step !== "q1";

  const backToSummary = () => { setEditingFromSummary(false); setStep("summary"); };
  const nextOrSummary = (next: Step) => editingFromSummary ? backToSummary() : setStep(next);
  const skipOrSummary = (next: Step, setDefault: () => void) => { setDefault(); nextOrSummary(next); };

  const resetProp = hasProgress && showInternalReset ? handleReset : undefined;

  const firstAnswerFiredRef = useRef(false);
  useEffect(() => {
    if (hasProgress && !firstAnswerFiredRef.current) {
      firstAnswerFiredRef.current = true;
      onFirstAnswer?.();
    }
    if (!hasProgress) firstAnswerFiredRef.current = false;
  }, [hasProgress, onFirstAnswer]);

  // Wait for the option-card artwork cache lookup to resolve before showing
  // any question step — otherwise every step starts with placeholder card
  // art that pops to the real (already-cached) photo a moment later, which
  // reads as "wrong image, then right image" on every single step.
  if (["q1", "q2", "q3", "q4", "q5"].includes(step) && !imagesReady) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-6">
        <FairyFigure size={90} />
        <p className="text-white/60 text-fs-subtitle font-light">{t("paintingImages")}</p>
      </div>
    );
  }

  if (step === "q1") return <>{GeneratingBadge}<Q1View key={resetToken} initialHero={answers.q1_hero} onNext={(h) => { setAnswer("q1_hero", h); nextOrSummary("q2"); }} onBack={editingFromSummary ? backToSummary : (onComplete ? undefined : () => router.push("/create"))} onSkip={() => skipOrSummary("q2", () => { if (!answers.q1_hero) setAnswer("q1_hero", pickRandom(SURPRISE_HERO_NAMES)); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q1} childName={childName} childAvatarUrl={childAvatarUrl} luna={luna} ui={ui} language={effectiveLanguage} companionTypes={companionTypes} siblingNames={siblingNames} animalTypes={animalTypes} /></>;
  if (step === "q2") return <>{GeneratingBadge}<Q2View key={resetToken} initialWorld={answers.q2_world} onNext={(w) => { setAnswer("q2_world", w); nextOrSummary("q3"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("q3", () => { if (!answers.q2_world) setAnswer("q2_world", pickRandom(worldOptions).label); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q2} luna={luna} ui={ui} worldOptions={worldOptions} language={effectiveLanguage} /></>;
  if (step === "q3") return <>{GeneratingBadge}<Q3View key={resetToken} heroName={answers.q1_hero} worldName={answers.q2_world} initialCompanion={answers.q3_companion} onNext={(c) => { setAnswer("q3_companion", c); nextOrSummary("q4"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("q4", () => { if (!answers.q3_companion) setAnswer("q3_companion", pickRandom(SURPRISE_COMPANIONS)); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q3} luna={luna} ui={ui} companionTypes={companionTypes} language={effectiveLanguage} siblingNames={siblingNames} animalTypes={animalTypes} childName={childName} /></>;
  if (step === "q4") return <>{GeneratingBadge}<Q4View key={resetToken} heroName={answers.q1_hero} companionName={localizeCompanionForDisplay(answers.q3_companion, companionTypes, ui, animalTypes)} initialEngine={answers.q4_engine} onNext={(e) => { setAnswer("q4_engine", e); nextOrSummary("q5"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("q5", () => { if (!answers.q4_engine) setAnswer("q4_engine", pickRandom(SURPRISE_ENGINES)); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q4} luna={luna} ui={ui} q4Categories={q4Categories} language={effectiveLanguage} /></>;
  if (step === "q5") return <>{GeneratingBadge}<Q5View key={resetToken} engineText={answers.q4_engine} initialMood={answers.q5_mood ?? null} onNext={(m) => { setAnswer("q5_mood", m); nextOrSummary("summary"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("generating", () => { if (!answers.q5_mood) setAnswer("q5_mood", "sleepy"); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q5} luna={luna} ui={ui} moodLabels={moodLabels} /></>;

  if (step === "summary") return (
    <>
      {ErrorBanner}
      <SummaryView key={resetToken} answers={answers} durationMinutes={durationMinutes} onDurationChange={setDuration} onEditStep={(s) => { setEditingFromSummary(true); setStep(s); }} onLaunch={handleLaunch} onReset={showInternalReset ? handleReset : undefined} luna={luna} ui={ui} moodLabels={moodLabels} companionTypes={companionTypes} animalTypes={animalTypes} audioUrl={questionAudios.summary} />
    </>
  );

  if (step === "generating" && seeds) return (
    <GeneratingView worldName={answers.q2_world} seeds={seeds} durationMinutes={durationMinutes} contentLanguage={effectiveLanguage} lessons={defaultLessons} childContext={childContext} onDone={handleDone} onError={handleGenError} luna={luna} />
  );

  if (step === "done") {
    if (isProducing && productionJobId) return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <BackButton onClick={() => { setIsProducing(false); setProductionJobId(null); }} />
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">{ui.producingDrama}</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress jobId={productionJobId} onDone={handleProductionDone} onError={handleProductionError} coverUrl={coverUrl || undefined} />
        </div>
      </div>
    );

    if (completedJob) return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <BackButton onClick={handleReset} />
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">{ui.dramaReady}</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={handleReset} />
        </div>
      </div>
    );

    return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <BackButton onClick={handleReset} />
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide truncate mx-2">
              {answers.q1_hero}{ui.storySuffix}
            </h1>
            <div className="w-8" />
          </div>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl text-fs-body" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
              ⚠ {error}
            </div>
          )}
          <ScriptTab
            blocks={scriptBlocks}
            voices={voicePool}
            onBlocksChange={setScriptBlocks}
            onProduce={handleProduce}
            isProducing={isProducing}
            summary={summary}
            coverUrl={coverUrl}
            isFetchingCover={isFetchingCover}
            onRegenerateCover={coverPrompt ? () => { setCoverUrl(""); fetchCover(coverPrompt, summary); } : undefined}
          />
        </div>
      </div>
    );
  }

  return <div className="flex items-center justify-center min-h-full"><button onClick={handleReset} className="text-white/50">{t("startOver")}</button></div>;
}
