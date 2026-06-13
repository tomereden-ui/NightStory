"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BLUEBELL, MOOD_LABELS } from "@/constants/bluebellScripts";
import { WORLD_OPTIONS } from "@/constants/worldOptions";
import {
  SURPRISE_HERO_NAMES,
  MAGICAL_NAME_CHIPS,
  SURPRISE_COMPANIONS,
  SURPRISE_ENGINES,
  pickRandom,
} from "@/constants/surprisePicks";
import { stripSoundCues, extractSoundCues } from "@/utils/stripSoundCues";
import type { ResolutionMood, StorySeeds } from "@/utils/buildStoryPrompt";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "q1" | "q2" | "q3" | "q4" | "q5" | "summary" | "generating" | "done";

interface Answers {
  q1_hero: string;
  q2_world: string;
  q3_companion: string;
  q4_engine: string;
  q5_mood: ResolutionMood | null;
}

// ─── BluebellLine: progressive word-by-word reveal ───────────────────────────

function BluebellLine({
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
    // words.length is derived from text — text is the real dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return (
    <p className="text-white/85 text-[17px] leading-relaxed font-light">
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            opacity: i < visible ? 1 : 0,
            transition: "opacity 0.15s ease",
            display: "inline",
          }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

// ─── LaunchCountdown: 3-second animated pause ─────────────────────────────────

function LaunchCountdown({ onComplete }: { onComplete: () => void }) {
  const [tick, setTick] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count++;
      setTick(count);
      if (count >= 3) {
        clearInterval(id);
        setTimeout(() => onCompleteRef.current(), 300);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-3 justify-center items-center my-6">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-700"
          style={{
            width: tick > i ? 14 : 8,
            height: tick > i ? 14 : 8,
            background: tick > i ? "#4fc3f7" : "rgba(79,195,247,0.2)",
            boxShadow: tick > i ? "0 0 12px rgba(79,195,247,0.7)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── OptionPill ──────────────────────────────────────────────────────────────

function OptionPill({
  label,
  emoji,
  selected,
  onClick,
}: {
  label: string;
  emoji?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-2"
      style={
        selected
          ? {
              background: "rgba(79,195,247,0.14)",
              border: "1px solid rgba(79,195,247,0.45)",
              color: "#4fc3f7",
            }
          : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.75)",
            }
      }
    >
      {emoji && <span className="text-base">{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}

// ─── TextInput ───────────────────────────────────────────────────────────────

function StoryInput({
  value,
  onChange,
  placeholder,
  maxSoftLimit,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxSoftLimit?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  const over = maxSoftLimit ? value.length > maxSoftLimit : false;
  return (
    <div>
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-colors"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)"}`,
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = over
            ? "rgba(236,72,153,0.5)"
            : "rgba(79,195,247,0.4)")
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = over
            ? "rgba(236,72,153,0.5)"
            : "rgba(255,255,255,0.12)")
        }
      />
      {over && (
        <p className="text-[11px] mt-1.5" style={{ color: "#EC4899" }}>
          {BLUEBELL.q4Hint}
        </p>
      )}
    </div>
  );
}

// ─── Primary action button ────────────────────────────────────────────────────

function PrimaryButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
      style={
        !disabled
          ? {
              background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
              color: "#05080F",
              boxShadow: "0 4px 24px rgba(79,195,247,0.35)",
            }
          : {
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.07)",
            }
      }
    >
      {label}
    </button>
  );
}

// ─── Shell (back button + Bluebell header) ────────────────────────────────────

function QuestionShell({
  onBack,
  children,
  bluebellText,
  bluebellSpeed,
  onBluebellComplete,
}: {
  onBack: () => void;
  children: React.ReactNode;
  bluebellText: string;
  bluebellSpeed?: number;
  onBluebellComplete?: () => void;
}) {
  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="flex items-center mb-8">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center text-white/40 text-base"
        >
          ←
        </button>
        <div className="flex-1 flex justify-center">
          <span className="text-2xl">🧚</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Bluebell speaks */}
      <div className="mb-7">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-3"
          style={{ color: "rgba(79,195,247,0.6)" }}
        >
          Bluebell
        </p>
        <BluebellLine
          text={bluebellText}
          speed={bluebellSpeed}
          onComplete={onBluebellComplete}
        />
      </div>

      {children}
    </div>
  );
}

// ─── Q1 — Hero identity ───────────────────────────────────────────────────────

type Q1Mode = null | "own" | "magical" | "stranger" | "surprise";

function Q1View({
  initialHero,
  onNext,
  onBack,
}: {
  initialHero: string;
  onNext: (hero: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Q1Mode>(null);
  const [textVal, setTextVal] = useState(initialHero);
  const [magicChip, setMagicChip] = useState<string | null>(
    MAGICAL_NAME_CHIPS.includes(initialHero) ? initialHero : null
  );
  const [surpriseName, setSurpriseName] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");

  // If returning from summary edit with a known value, pre-select mode
  useEffect(() => {
    if (!initialHero) return;
    if (MAGICAL_NAME_CHIPS.includes(initialHero)) {
      setMode("magical");
      setMagicChip(initialHero);
    } else if (initialHero) {
      setMode("own");
      setTextVal(initialHero);
    }
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (name: string) => {
    if (!name.trim()) {
      setValidationError(BLUEBELL.emptyError);
      return;
    }
    setTransitionMsg(BLUEBELL.q1Confirm(name));
    setTransitioning(true);
    setTimeout(() => {
      setTransitioning(false);
      onNext(name.trim());
    }, 1500);
  };

  const handleSurprise = () => {
    const picked = pickRandom(SURPRISE_HERO_NAMES);
    setSurpriseName(picked);
    setMode("surprise");
  };

  if (transitioning) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-5">
        <span className="text-4xl mb-6">🧚</span>
        <p
          className="text-white text-xl font-light text-center leading-relaxed"
          style={{ color: "#4fc3f7" }}
        >
          {transitionMsg}
        </p>
      </div>
    );
  }

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q1}>
      <div className="flex flex-col gap-3">
        {/* Mode options */}
        {mode === null && (
          <>
            <OptionPill label="Your own name" emoji="👤" onClick={() => setMode("own")} />
            <OptionPill label="A magical name" emoji="✨" onClick={() => setMode("magical")} />
            <OptionPill label="A brave stranger" emoji="🗺️" onClick={() => setMode("stranger")} />
            <OptionPill label="Surprise me!" emoji="🎲" onClick={handleSurprise} />
          </>
        )}

        {/* Own name */}
        {mode === "own" && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs mb-1 text-left">← back</button>
            <StoryInput
              value={textVal}
              onChange={(v) => { setTextVal(v); setValidationError(""); }}
              placeholder={BLUEBELL.q1TextOwn}
              autoFocus
              onSubmit={() => confirm(textVal)}
            />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton label="That's the one!" onClick={() => confirm(textVal)} disabled={!textVal.trim()} />
          </>
        )}

        {/* Magical name chips */}
        {mode === "magical" && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs mb-1 text-left">← back</button>
            <div className="flex flex-wrap gap-2">
              {MAGICAL_NAME_CHIPS.map((n) => (
                <button
                  key={n}
                  onClick={() => setMagicChip(n)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                  style={
                    magicChip === n
                      ? { background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }
                      : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <PrimaryButton label="Choose this name" onClick={() => magicChip && confirm(magicChip)} disabled={!magicChip} />
          </>
        )}

        {/* Brave stranger */}
        {mode === "stranger" && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs mb-1 text-left">← back</button>
            <StoryInput
              value={textVal}
              onChange={(v) => { setTextVal(v); setValidationError(""); }}
              placeholder={BLUEBELL.q1TextStranger}
              autoFocus
              onSubmit={() => confirm(textVal)}
            />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton label="That's the one!" onClick={() => confirm(textVal)} disabled={!textVal.trim()} />
          </>
        )}

        {/* Surprise confirm */}
        {mode === "surprise" && (
          <>
            <div
              className="rounded-2xl px-5 py-4 text-center mb-2"
              style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)" }}
            >
              <p className="text-white/40 text-xs mb-1">Your hero is...</p>
              <p className="text-white text-2xl font-bold" style={{ color: "#4fc3f7" }}>{surpriseName}</p>
            </div>
            <PrimaryButton label={`Yes — ${surpriseName}!`} onClick={() => confirm(surpriseName)} />
            <button
              onClick={handleSurprise}
              className="text-white/35 text-xs text-center w-full py-2"
            >
              Try another
            </button>
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q2 — Story world ─────────────────────────────────────────────────────────

function Q2View({
  heroName,
  initialWorld,
  onNext,
  onBack,
}: {
  heroName: string;
  initialWorld: string;
  onNext: (world: string) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState(initialWorld);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");

  const confirm = (world: string) => {
    setTransitionMsg(BLUEBELL.q2Confirm(world));
    setTransitioning(true);
    setTimeout(() => {
      setTransitioning(false);
      onNext(world);
    }, 1500);
  };

  const handleSurprise = () => {
    const w = pickRandom(WORLD_OPTIONS);
    setSelected(w.label);
  };

  if (transitioning) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-5">
        <span className="text-4xl mb-6">🧚</span>
        <p className="text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>
          {transitionMsg}
        </p>
      </div>
    );
  }

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q2(heroName)}>
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {WORLD_OPTIONS.map((w) => {
          const isSel = selected === w.label;
          return (
            <button
              key={w.id}
              onClick={() => setSelected(w.label)}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-[0.97]"
              style={
                isSel
                  ? { background: "rgba(79,195,247,0.12)", border: "1.5px solid rgba(79,195,247,0.5)" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }
              }
            >
              <span className="text-2xl">{w.emoji}</span>
              <span
                className="text-xs font-medium text-center leading-tight"
                style={{ color: isSel ? "#4fc3f7" : "rgba(255,255,255,0.65)" }}
              >
                {w.label}
              </span>
            </button>
          );
        })}
      </div>

      <OptionPill
        label="Surprise me!"
        emoji="🎲"
        selected={false}
        onClick={handleSurprise}
      />

      <div className="mt-4">
        <PrimaryButton
          label="This is the world!"
          onClick={() => selected && confirm(selected)}
          disabled={!selected}
        />
      </div>
    </QuestionShell>
  );
}

// ─── Q3 — Companion ───────────────────────────────────────────────────────────

type Q3Mode = null | "friend" | "pet" | "creature" | "family" | "surprise";

function Q3View({
  heroName,
  worldName,
  initialCompanion,
  onNext,
  onBack,
}: {
  heroName: string;
  worldName: string;
  initialCompanion: string;
  onNext: (companion: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Q3Mode>(null);
  const [textVal, setTextVal] = useState(initialCompanion);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (initialCompanion) { setMode("friend"); setTextVal(initialCompanion); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (companion: string) => {
    if (!companion.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setTransitionMsg(BLUEBELL.q3Confirm(companion.trim()));
    setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(companion.trim()); }, 1500);
  };

  const handleSurprise = () => {
    const picked = pickRandom(SURPRISE_COMPANIONS);
    setTextVal(picked);
    setMode("creature");
  };

  const COMPANION_MODES: { id: Q3Mode; label: string; emoji: string; placeholder: string }[] = [
    { id: "friend",  label: "Best friend",       emoji: "👫", placeholder: "What's their name?" },
    { id: "pet",     label: "A pet",              emoji: "🐾", placeholder: "What kind of pet? What's their name?" },
    { id: "creature",label: "A magical creature", emoji: "🦄", placeholder: "What kind of creature?" },
    { id: "family",  label: "A family member",    emoji: "👨‍👩‍👧", placeholder: "Who?" },
  ];

  if (transitioning) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-5">
        <span className="text-4xl mb-6">🧚</span>
        <p className="text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>
          {transitionMsg}
        </p>
      </div>
    );
  }

  const activeMode = COMPANION_MODES.find((m) => m.id === mode);

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q3(worldName, heroName)}>
      <div className="flex flex-col gap-3">
        {mode === null && (
          <>
            {COMPANION_MODES.map((m) => (
              <OptionPill key={m.id} label={m.label} emoji={m.emoji} onClick={() => setMode(m.id)} />
            ))}
            <OptionPill label="Surprise me!" emoji="🎲" onClick={handleSurprise} />
            <p className="text-xs text-center mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              {BLUEBELL.q3Nudge}
            </p>
          </>
        )}

        {mode !== null && mode !== "surprise" && activeMode && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs text-left">← back</button>
            <p className="text-sm text-white/50">{activeMode.label}</p>
            <StoryInput
              value={textVal}
              onChange={(v) => { setTextVal(v); setValidationError(""); }}
              placeholder={activeMode.placeholder}
              autoFocus
              onSubmit={() => confirm(textVal)}
            />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton label="Magnificent!" onClick={() => confirm(textVal)} disabled={!textVal.trim()} />
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q4 — Dramatic engine ─────────────────────────────────────────────────────

type Q4Mode = null | "funny" | "spooky" | "weird" | "delicious";
type Q4Phase = "input" | "reaction1" | "reaction2";

function Q4View({
  heroName,
  companionName,
  initialEngine,
  onNext,
  onBack,
}: {
  heroName: string;
  companionName: string;
  initialEngine: string;
  onNext: (engine: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Q4Mode>(null);
  const [textVal, setTextVal] = useState(initialEngine);
  const [phase, setPhase] = useState<Q4Phase>("input");
  const [confirmedEngine, setConfirmedEngine] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (initialEngine) { setMode("funny"); setTextVal(initialEngine); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (engine: string) => {
    if (!engine.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setConfirmedEngine(engine.trim());
    // Pause 1.5s, then show reaction
    setTimeout(() => setPhase("reaction1"), 1500);
  };

  const handleSurprise = () => {
    const picked = pickRandom(SURPRISE_ENGINES);
    setTextVal(picked);
    setMode("funny");
  };

  const Q4_MODES: { id: Q4Mode; label: string; emoji: string; placeholder: string }[] = [
    { id: "funny",    label: "Something funny",     emoji: "😂", placeholder: "like... giant sneezing broccoli" },
    { id: "spooky",   label: "Something spooky-fun", emoji: "👻", placeholder: "like... shadows that giggle" },
    { id: "weird",    label: "Something very weird", emoji: "🌀", placeholder: "like... invisible cheese" },
    { id: "delicious",label: "Something delicious",  emoji: "🍫", placeholder: "like... a river of hot chocolate" },
  ];

  // Reaction screens
  if (phase === "reaction1") {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
        <span className="text-4xl">🧚</span>
        <BluebellLine
          text={BLUEBELL.q4Reaction1}
          speed={90}
          onComplete={() => setTimeout(() => setPhase("reaction2"), 600)}
        />
      </div>
    );
  }

  if (phase === "reaction2") {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
        <span className="text-4xl">🧚</span>
        <p className="text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>
          {BLUEBELL.q4Confirm(confirmedEngine)}
        </p>
        {/* Auto-advance after 1s */}
        <AutoAdvance delay={1200} onAdvance={() => onNext(confirmedEngine)} />
      </div>
    );
  }

  const activeMode = Q4_MODES.find((m) => m.id === mode);

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q4(companionName, heroName)}>
      <div className="flex flex-col gap-3">
        {mode === null && (
          <>
            {Q4_MODES.map((m) => (
              <OptionPill key={m.id} label={m.label} emoji={m.emoji} onClick={() => setMode(m.id)} />
            ))}
            <OptionPill label="Surprise me!" emoji="🎲" onClick={handleSurprise} />
          </>
        )}

        {mode !== null && activeMode && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs text-left">← back</button>
            <p className="text-sm text-white/50">{activeMode.label}</p>
            <StoryInput
              value={textVal}
              onChange={(v) => { setTextVal(v); setValidationError(""); }}
              placeholder={activeMode.placeholder}
              maxSoftLimit={80}
              autoFocus
              onSubmit={() => confirm(textVal)}
            />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton
              label="That's it!"
              onClick={() => confirm(textVal)}
              disabled={!textVal.trim()}
            />
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── AutoAdvance helper ───────────────────────────────────────────────────────

function AutoAdvance({ delay, onAdvance }: { delay: number; onAdvance: () => void }) {
  const ref = useRef(onAdvance);
  ref.current = onAdvance;
  useEffect(() => {
    const id = setTimeout(() => ref.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return null;
}

// ─── Q5 — Resolution mood ─────────────────────────────────────────────────────

function Q5View({
  heroName,
  engineText,
  onNext,
  onBack,
}: {
  heroName: string;
  engineText: string;
  onNext: (mood: ResolutionMood) => void;
  onBack: () => void;
}) {
  const MOODS: { id: ResolutionMood; label: string; emoji: string; isBedtime?: boolean }[] = [
    { id: "brave",     label: "Super brave",           emoji: "🦁" },
    { id: "laughing",  label: "Laughing so much",       emoji: "😂" },
    { id: "surprised", label: "Wonderfully surprised",  emoji: "🌟" },
    { id: "sleepy",    label: "Warm and sleepy",         emoji: "🌙", isBedtime: true },
  ];

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q5(engineText, heroName)}>
      <div className="flex flex-col gap-3">
        {MOODS.map((m) => (
          <button
            key={m.id}
            onClick={() => onNext(m.id)}
            className="w-full text-left px-4 py-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-3"
            style={
              m.isBedtime
                ? {
                    background: "rgba(251,191,36,0.06)",
                    border: "1.5px solid rgba(251,191,36,0.35)",
                    color: "rgba(255,255,255,0.8)",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.75)",
                  }
            }
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="flex-1">{m.label}</span>
            {m.isBedtime && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(251,191,36,0.15)", color: "#FBB824" }}
              >
                bedtime ending
              </span>
            )}
          </button>
        ))}
      </div>
    </QuestionShell>
  );
}

// ─── Summary screen ───────────────────────────────────────────────────────────

type SummaryPhase = "table" | "script" | "countdown" | "herewego";

function SummaryView({
  answers,
  onEditStep,
  onLaunch,
}: {
  answers: Answers;
  onEditStep: (step: Step) => void;
  onLaunch: () => void;
}) {
  const [phase, setPhase] = useState<SummaryPhase>("table");
  const [showReady, setShowReady] = useState(false);
  const [countdownDone, setCountdownDone] = useState(false);

  const moodLabel = answers.q5_mood ? MOOD_LABELS[answers.q5_mood] : "";

  const launchScript = BLUEBELL.launch(
    moodLabel,
    answers.q1_hero,
    answers.q3_companion,
    answers.q2_world,
    answers.q4_engine
  );

  const ROWS: { label: string; value: string; step: Step }[] = [
    { label: "Hero",      value: answers.q1_hero,       step: "q1" },
    { label: "World",     value: answers.q2_world,       step: "q2" },
    { label: "Companion", value: answers.q3_companion,   step: "q3" },
    { label: "Challenge", value: answers.q4_engine,      step: "q4" },
    { label: "Ending",    value: moodLabel,               step: "q5" },
  ];

  const handleCountdownDone = useCallback(() => {
    setCountdownDone(true);
    setPhase("herewego");
    setTimeout(onLaunch, 1500);
  }, [onLaunch]);

  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-8">
        <button
          onClick={() => onEditStep("q5")}
          className="w-8 h-8 flex items-center justify-center text-white/40 text-base"
        >
          ←
        </button>
        <div className="flex-1 text-center">
          <span className="text-2xl">🧚</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Summary table */}
      <div
        className="rounded-2xl mb-6 overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {ROWS.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center px-4 py-3 gap-3"
            style={{
              borderBottom: i < ROWS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest w-20 flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {row.label}
            </span>
            <span className="flex-1 text-sm text-white/80 truncate">{row.value}</span>
            <button
              onClick={() => onEditStep(row.step)}
              className="text-[10px] px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{
                background: "rgba(79,195,247,0.08)",
                color: "rgba(79,195,247,0.7)",
                border: "1px solid rgba(79,195,247,0.2)",
              }}
            >
              edit
            </button>
          </div>
        ))}
      </div>

      {/* Bluebell launch script */}
      {phase === "table" && (
        <PrimaryButton
          label="Ready to hear the story?"
          onClick={() => setPhase("script")}
        />
      )}

      {(phase === "script" || phase === "countdown" || phase === "herewego") && (
        <div className="flex flex-col gap-5">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "rgba(79,195,247,0.6)" }}
            >
              Bluebell
            </p>
            <BluebellLine
              text={launchScript}
              speed={65}
              onComplete={() => {
                setShowReady(true);
                setTimeout(() => setPhase("countdown"), 600);
              }}
            />
          </div>

          {showReady && phase !== "herewego" && (
            <p className="text-white/60 text-sm italic text-center">Are you ready?</p>
          )}

          {phase === "countdown" && (
            <LaunchCountdown onComplete={handleCountdownDone} />
          )}

          {phase === "herewego" && (
            <p className="text-center text-lg font-semibold" style={{ color: "#4fc3f7" }}>
              {BLUEBELL.hereWeGo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generating screen ────────────────────────────────────────────────────────

function GeneratingView({
  heroName,
  worldName,
  onDone,
  onError,
  seeds,
}: {
  heroName: string;
  worldName: string;
  onDone: (story: string, soundCues: string[]) => void;
  onError: (msg: string) => void;
  seeds: StorySeeds;
}) {
  const messages = BLUEBELL.generating(heroName, worldName);
  const [msgIdx, setMsgIdx] = useState(0);
  const [showLong, setShowLong] = useState(false);
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  onDoneRef.current = onDone;
  onErrorRef.current = onError;

  useEffect(() => {
    // Cycle messages every 3 seconds
    const msgId = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 3000);

    // After 20s, show "almost there"
    const longId = setTimeout(() => setShowLong(true), 20_000);

    // API call
    const controller = new AbortController();
    fetch("/api/five-question-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seeds }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        const raw: string = data.story ?? "";
        const cues = extractSoundCues(raw);
        onDoneRef.current(raw, cues);
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        onErrorRef.current(err instanceof Error ? err.message : String(err));
      });

    return () => {
      controller.abort();
      clearInterval(msgId);
      clearTimeout(longId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-8"
      style={{ background: "transparent" }}
    >
      <div className="relative w-28 h-28 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-15"
          style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }}
        />
        <div
          className="absolute inset-3 rounded-full opacity-30 animate-pulse"
          style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }}
        />
        <span className="relative text-5xl">🧚</span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-white text-base font-medium">{messages[msgIdx]}</p>
        {showLong && (
          <p className="text-white/40 text-sm">{BLUEBELL.generatingLong}</p>
        )}
      </div>

      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: "linear-gradient(135deg,#4fc3f7,#0088AA)",
              animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Story player (done state) ────────────────────────────────────────────────

function StoryView({
  title,
  rawStory,
  soundCues,
  onReset,
}: {
  title: string;
  rawStory: string;
  soundCues: string[];
  onReset: () => void;
}) {
  const displayText = stripSoundCues(rawStory);
  const paragraphs = displayText.split(/\n+/).filter((p) => p.trim());

  return (
    <div className="flex flex-col min-h-full" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="flex items-center px-5 pt-12 pb-4">
        <button
          onClick={onReset}
          className="w-8 h-8 flex items-center justify-center text-white/40 text-base"
        >
          ←
        </button>
        <p className="flex-1 text-center text-sm font-semibold text-white truncate mx-2">{title}</p>
        <div className="w-8" />
      </div>

      {/* Sound cue pill */}
      {soundCues.length > 0 && (
        <div className="px-5 mb-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px]"
            style={{ background: "rgba(79,195,247,0.08)", color: "rgba(79,195,247,0.6)", border: "1px solid rgba(79,195,247,0.2)" }}
          >
            <span>🔊</span>
            <span>{soundCues.length} sound cues ready</span>
          </div>
        </div>
      )}

      {/* Story text */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex flex-col gap-4">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-sm leading-[1.85] text-white/75"
            >
              {p}
            </p>
          ))}
        </div>
        <div className="h-6" />
      </div>

      {/* Player panel */}
      <div className="px-4 pb-4">
        <div
          className="rounded-3xl px-4 py-4 flex flex-col gap-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: "rgba(79,195,247,0.06)",
              border: "1px solid rgba(79,195,247,0.25)",
              color: "rgba(79,195,247,0.6)",
            }}
          >
            ▶ Play (coming soon)
          </button>
          <button
            onClick={onReset}
            className="w-full py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            ✨ Make another story
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

const INITIAL_ANSWERS: Answers = {
  q1_hero: "",
  q2_world: "",
  q3_companion: "",
  q4_engine: "",
  q5_mood: null,
};

export default function FiveQuestionPage() {
  const [step, setStep] = useState<Step>("q1");
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [soundCues, setSoundCues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const setAnswer = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setStep("q1");
    setAnswers(INITIAL_ANSWERS);
    setGeneratedStory(null);
    setSoundCues([]);
    setError(null);
  };

  const handleBack = () => {
    const order: Step[] = ["q1", "q2", "q3", "q4", "q5", "summary"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
    else handleReset(); // q1 back → create page handled by browser nav
  };

  const handleLaunch = useCallback(() => {
    setStep("generating");
    setError(null);
  }, []);

  const handleDone = useCallback((story: string, cues: string[]) => {
    setGeneratedStory(story);
    setSoundCues(cues);
    setStep("done");
  }, []);

  const handleGenError = useCallback((msg: string) => {
    setError(msg);
    setStep("summary");
  }, []);

  const seeds: StorySeeds | null =
    answers.q5_mood
      ? {
          q1_hero: answers.q1_hero,
          q2_world: answers.q2_world,
          q3_companion: answers.q3_companion,
          q4_engine: answers.q4_engine,
          q5_mood: answers.q5_mood,
        }
      : null;

  const storyTitle = `${answers.q1_hero}'s adventure in ${answers.q2_world}`;

  // Error banner (shown on summary after failed generation)
  const ErrorBanner = error ? (
    <div
      className="mx-5 mb-4 px-4 py-3 rounded-2xl text-sm"
      style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}
    >
      <p>⚠ {BLUEBELL.apiError}</p>
      <p className="text-xs mt-1 opacity-70">{error}</p>
    </div>
  ) : null;

  if (step === "q1") {
    return <Q1View initialHero={answers.q1_hero} onNext={(hero) => { setAnswer("q1_hero", hero); setStep("q2"); }} onBack={handleReset} />;
  }

  if (step === "q2") {
    return <Q2View heroName={answers.q1_hero} initialWorld={answers.q2_world} onNext={(world) => { setAnswer("q2_world", world); setStep("q3"); }} onBack={handleBack} />;
  }

  if (step === "q3") {
    return <Q3View heroName={answers.q1_hero} worldName={answers.q2_world} initialCompanion={answers.q3_companion} onNext={(c) => { setAnswer("q3_companion", c); setStep("q4"); }} onBack={handleBack} />;
  }

  if (step === "q4") {
    return <Q4View heroName={answers.q1_hero} companionName={answers.q3_companion} initialEngine={answers.q4_engine} onNext={(e) => { setAnswer("q4_engine", e); setStep("q5"); }} onBack={handleBack} />;
  }

  if (step === "q5") {
    return <Q5View heroName={answers.q1_hero} engineText={answers.q4_engine} onNext={(mood) => { setAnswer("q5_mood", mood); setStep("summary"); }} onBack={handleBack} />;
  }

  if (step === "summary") {
    return (
      <>
        {ErrorBanner}
        <SummaryView
          answers={answers}
          onEditStep={(s) => setStep(s)}
          onLaunch={handleLaunch}
        />
      </>
    );
  }

  if (step === "generating" && seeds) {
    return (
      <GeneratingView
        heroName={answers.q1_hero}
        worldName={answers.q2_world}
        seeds={seeds}
        onDone={handleDone}
        onError={handleGenError}
      />
    );
  }

  if (step === "done" && generatedStory) {
    return (
      <StoryView
        title={storyTitle}
        rawStory={generatedStory}
        soundCues={soundCues}
        onReset={handleReset}
      />
    );
  }

  // Fallback — should not reach here
  return (
    <div className="flex items-center justify-center min-h-full">
      <button onClick={handleReset} className="text-white/50">Start over</button>
    </div>
  );
}
