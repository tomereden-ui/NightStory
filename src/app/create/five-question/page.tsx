"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BLUEBELL, MOOD_LABELS } from "@/constants/bluebellScripts";
import { WORLD_OPTIONS } from "@/constants/worldOptions";
import {
  SURPRISE_HERO_NAMES,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return (
    <p className="text-white/85 text-[17px] leading-relaxed font-light">
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

// ─── Shared primitives ────────────────────────────────────────────────────────

function OptionPill({ label, emoji, selected, onClick }: { label: string; emoji?: string; selected?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-2"
      style={selected
        ? { background: "rgba(79,195,247,0.14)", border: "1px solid rgba(79,195,247,0.45)", color: "#4fc3f7" }
        : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}>
      {emoji && <span className="text-base">{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}

function StoryInput({ value, onChange, placeholder, maxSoftLimit, autoFocus, onSubmit }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  maxSoftLimit?: number; autoFocus?: boolean; onSubmit?: () => void;
}) {
  const over = maxSoftLimit ? value.length > maxSoftLimit : false;
  return (
    <div>
      <input autoFocus={autoFocus} type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-colors"
        style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)"}` }}
        onFocus={(e) => (e.currentTarget.style.borderColor = over ? "rgba(236,72,153,0.5)" : "rgba(79,195,247,0.4)")}
        onBlur={(e)  => (e.currentTarget.style.borderColor = over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)")} />
      {over && <p className="text-[11px] mt-1.5" style={{ color: "#EC4899" }}>{BLUEBELL.q4Hint}</p>}
    </div>
  );
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
      style={!disabled
        ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }
        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {label}
    </button>
  );
}

function QuestionShell({ onBack, children, bluebellText, bluebellSpeed, onBluebellComplete }: {
  onBack: () => void; children: React.ReactNode;
  bluebellText: string; bluebellSpeed?: number; onBluebellComplete?: () => void;
}) {
  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-8">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center text-white/40 text-base">←</button>
        <div className="flex-1 flex justify-center"><span className="text-2xl">🧚</span></div>
        <div className="w-8" />
      </div>
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.6)" }}>Bluebell</p>
        <BluebellLine text={bluebellText} speed={bluebellSpeed} onComplete={onBluebellComplete} />
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

// ─── Q1 — Hero identity ───────────────────────────────────────────────────────

type Q1Mode = null | "own" | "magical" | "stranger" | "surprise";

function Q1View({ initialHero, onNext, onBack }: { initialHero: string; onNext: (hero: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Q1Mode>(null);
  const [textVal, setTextVal] = useState(initialHero);
  const [magicChip, setMagicChip] = useState<string | null>(MAGICAL_NAME_CHIPS.includes(initialHero) ? initialHero : null);
  const [surpriseName, setSurpriseName] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!initialHero) return;
    if (MAGICAL_NAME_CHIPS.includes(initialHero)) { setMode("magical"); setMagicChip(initialHero); }
    else { setMode("own"); setTextVal(initialHero); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (name: string) => {
    if (!name.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setTransitionMsg(BLUEBELL.q1Confirm(name));
    setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(name.trim()); }, 1500);
  };

  const handleSurprise = () => { const p = pickRandom(SURPRISE_HERO_NAMES); setSurpriseName(p); setMode("surprise"); };

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <span className="text-4xl mb-6">🧚</span>
      <p className="text-white text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q1}>
      <div className="flex flex-col gap-3">
        {mode === null && (
          <>
            <OptionPill label="Your own name" emoji="👤" onClick={() => setMode("own")} />
            <OptionPill label="A magical name" emoji="✨" onClick={() => setMode("magical")} />
            <OptionPill label="A brave stranger" emoji="🗺️" onClick={() => setMode("stranger")} />
            <OptionPill label="Surprise me!" emoji="🎲" onClick={handleSurprise} />
          </>
        )}
        {mode === "own" && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs mb-1 text-left">← back</button>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={BLUEBELL.q1TextOwn} autoFocus onSubmit={() => confirm(textVal)} />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton label="That's the one!" onClick={() => confirm(textVal)} disabled={!textVal.trim()} />
          </>
        )}
        {mode === "magical" && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs mb-1 text-left">← back</button>
            <div className="flex flex-wrap gap-2">
              {MAGICAL_NAME_CHIPS.map((n) => (
                <button key={n} onClick={() => setMagicChip(n)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                  style={magicChip === n
                    ? { background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                  {n}
                </button>
              ))}
            </div>
            <PrimaryButton label="Choose this name" onClick={() => magicChip && confirm(magicChip)} disabled={!magicChip} />
          </>
        )}
        {mode === "stranger" && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs mb-1 text-left">← back</button>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={BLUEBELL.q1TextStranger} autoFocus onSubmit={() => confirm(textVal)} />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton label="That's the one!" onClick={() => confirm(textVal)} disabled={!textVal.trim()} />
          </>
        )}
        {mode === "surprise" && (
          <>
            <div className="rounded-2xl px-5 py-4 text-center mb-2"
              style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)" }}>
              <p className="text-white/40 text-xs mb-1">Your hero is...</p>
              <p className="text-white text-2xl font-bold" style={{ color: "#4fc3f7" }}>{surpriseName}</p>
            </div>
            <PrimaryButton label={`Yes — ${surpriseName}!`} onClick={() => confirm(surpriseName)} />
            <button onClick={handleSurprise} className="text-white/35 text-xs text-center w-full py-2">Try another</button>
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q2 — Story world ─────────────────────────────────────────────────────────

function Q2View({ heroName, initialWorld, onNext, onBack }: { heroName: string; initialWorld: string; onNext: (world: string) => void; onBack: () => void }) {
  const [selected, setSelected] = useState(initialWorld);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");

  const confirm = (world: string) => {
    setTransitionMsg(BLUEBELL.q2Confirm(world)); setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(world); }, 1500);
  };

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <span className="text-4xl mb-6">🧚</span>
      <p className="text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q2(heroName)}>
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {WORLD_OPTIONS.map((w) => {
          const isSel = selected === w.label;
          return (
            <button key={w.id} onClick={() => setSelected(w.label)}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-[0.97]"
              style={isSel
                ? { background: "rgba(79,195,247,0.12)", border: "1.5px solid rgba(79,195,247,0.5)" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-2xl">{w.emoji}</span>
              <span className="text-xs font-medium text-center leading-tight" style={{ color: isSel ? "#4fc3f7" : "rgba(255,255,255,0.65)" }}>{w.label}</span>
            </button>
          );
        })}
      </div>
      <OptionPill label="Surprise me!" emoji="🎲" onClick={() => setSelected(pickRandom(WORLD_OPTIONS).label)} />
      <div className="mt-4">
        <PrimaryButton label="This is the world!" onClick={() => selected && confirm(selected)} disabled={!selected} />
      </div>
    </QuestionShell>
  );
}

// ─── Q3 — Companion ───────────────────────────────────────────────────────────

type Q3Mode = null | "friend" | "pet" | "creature" | "family";

function Q3View({ heroName, worldName, initialCompanion, onNext, onBack }: { heroName: string; worldName: string; initialCompanion: string; onNext: (c: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Q3Mode>(null);
  const [textVal, setTextVal] = useState(initialCompanion);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => { if (initialCompanion) { setMode("friend"); setTextVal(initialCompanion); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (companion: string) => {
    if (!companion.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setTransitionMsg(BLUEBELL.q3Confirm(companion.trim())); setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(companion.trim()); }, 1500);
  };

  const COMPANION_MODES: { id: Q3Mode; label: string; emoji: string; placeholder: string }[] = [
    { id: "friend",   label: "Best friend",        emoji: "👫", placeholder: "What's their name?" },
    { id: "pet",      label: "A pet",               emoji: "🐾", placeholder: "What kind of pet? What's their name?" },
    { id: "creature", label: "A magical creature",  emoji: "🦄", placeholder: "What kind of creature?" },
    { id: "family",   label: "A family member",     emoji: "👨‍👩‍👧", placeholder: "Who?" },
  ];

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <span className="text-4xl mb-6">🧚</span>
      <p className="text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  const activeMode = COMPANION_MODES.find((m) => m.id === mode);

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q3(worldName, heroName)}>
      <div className="flex flex-col gap-3">
        {mode === null && (
          <>
            {COMPANION_MODES.map((m) => <OptionPill key={m.id} label={m.label} emoji={m.emoji} onClick={() => setMode(m.id)} />)}
            <OptionPill label="Surprise me!" emoji="🎲" onClick={() => { setTextVal(pickRandom(SURPRISE_COMPANIONS)); setMode("creature"); }} />
            <p className="text-xs text-center mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{BLUEBELL.q3Nudge}</p>
          </>
        )}
        {mode !== null && activeMode && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs text-left">← back</button>
            <p className="text-sm text-white/50">{activeMode.label}</p>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={activeMode.placeholder} autoFocus onSubmit={() => confirm(textVal)} />
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

function Q4View({ heroName, companionName, initialEngine, onNext, onBack }: { heroName: string; companionName: string; initialEngine: string; onNext: (e: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Q4Mode>(null);
  const [textVal, setTextVal] = useState(initialEngine);
  const [phase, setPhase] = useState<Q4Phase>("input");
  const [confirmedEngine, setConfirmedEngine] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => { if (initialEngine) { setMode("funny"); setTextVal(initialEngine); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (engine: string) => {
    if (!engine.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setConfirmedEngine(engine.trim());
    setTimeout(() => setPhase("reaction1"), 1500);
  };

  const Q4_MODES: { id: Q4Mode; label: string; emoji: string; placeholder: string }[] = [
    { id: "funny",    label: "Something funny",      emoji: "😂", placeholder: "like... giant sneezing broccoli" },
    { id: "spooky",   label: "Something spooky-fun", emoji: "👻", placeholder: "like... shadows that giggle" },
    { id: "weird",    label: "Something very weird",  emoji: "🌀", placeholder: "like... invisible cheese" },
    { id: "delicious",label: "Something delicious",   emoji: "🍫", placeholder: "like... a river of hot chocolate" },
  ];

  if (phase === "reaction1") return (
    <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
      <span className="text-4xl">🧚</span>
      <BluebellLine text={BLUEBELL.q4Reaction1} speed={90} onComplete={() => setTimeout(() => setPhase("reaction2"), 600)} />
    </div>
  );

  if (phase === "reaction2") return (
    <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
      <span className="text-4xl">🧚</span>
      <p className="text-xl font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{BLUEBELL.q4Confirm(confirmedEngine)}</p>
      <AutoAdvance delay={1200} onAdvance={() => onNext(confirmedEngine)} />
    </div>
  );

  const activeMode = Q4_MODES.find((m) => m.id === mode);

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q4(companionName, heroName)}>
      <div className="flex flex-col gap-3">
        {mode === null && (
          <>
            {Q4_MODES.map((m) => <OptionPill key={m.id} label={m.label} emoji={m.emoji} onClick={() => setMode(m.id)} />)}
            <OptionPill label="Surprise me!" emoji="🎲" onClick={() => { setTextVal(pickRandom(SURPRISE_ENGINES)); setMode("funny"); }} />
          </>
        )}
        {mode !== null && activeMode && (
          <>
            <button onClick={() => setMode(null)} className="text-white/35 text-xs text-left">← back</button>
            <p className="text-sm text-white/50">{activeMode.label}</p>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={activeMode.placeholder} maxSoftLimit={80} autoFocus onSubmit={() => confirm(textVal)} />
            {validationError && <p className="text-xs" style={{ color: "#EC4899" }}>{validationError}</p>}
            <PrimaryButton label="That's it!" onClick={() => confirm(textVal)} disabled={!textVal.trim()} />
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q5 — Resolution mood ─────────────────────────────────────────────────────

function Q5View({ heroName, engineText, onNext, onBack }: { heroName: string; engineText: string; onNext: (mood: ResolutionMood) => void; onBack: () => void }) {
  const MOODS: { id: ResolutionMood; label: string; emoji: string; isBedtime?: boolean }[] = [
    { id: "brave",     label: "Super brave",          emoji: "🦁" },
    { id: "laughing",  label: "Laughing so much",      emoji: "😂" },
    { id: "surprised", label: "Wonderfully surprised", emoji: "🌟" },
    { id: "sleepy",    label: "Warm and sleepy",        emoji: "🌙", isBedtime: true },
  ];

  return (
    <QuestionShell onBack={onBack} bluebellText={BLUEBELL.q5(engineText, heroName)}>
      <div className="flex flex-col gap-3">
        {MOODS.map((m) => (
          <button key={m.id} onClick={() => onNext(m.id)}
            className="w-full text-left px-4 py-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-3"
            style={m.isBedtime
              ? { background: "rgba(251,191,36,0.06)", border: "1.5px solid rgba(251,191,36,0.35)", color: "rgba(255,255,255,0.8)" }
              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}>
            <span className="text-xl">{m.emoji}</span>
            <span className="flex-1">{m.label}</span>
            {m.isBedtime && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(251,191,36,0.15)", color: "#FBB824" }}>bedtime ending</span>
            )}
          </button>
        ))}
      </div>
    </QuestionShell>
  );
}

// ─── Summary screen ───────────────────────────────────────────────────────────

type SummaryPhase = "table" | "script" | "countdown" | "herewego";

function SummaryView({ answers, durationMinutes, onDurationChange, onEditStep, onLaunch }: {
  answers: Answers;
  durationMinutes: number;
  onDurationChange: (v: number) => void;
  onEditStep: (step: Step) => void;
  onLaunch: () => void;
}) {
  const [phase, setPhase] = useState<SummaryPhase>("table");
  const [showReady, setShowReady] = useState(false);

  const moodLabel = answers.q5_mood ? MOOD_LABELS[answers.q5_mood] : "";
  const launchScript = BLUEBELL.launch(moodLabel, answers.q1_hero, answers.q3_companion, answers.q2_world, answers.q4_engine);

  const ROWS: { label: string; value: string; step: Step }[] = [
    { label: "Hero",      value: answers.q1_hero,     step: "q1" },
    { label: "World",     value: answers.q2_world,     step: "q2" },
    { label: "Companion", value: answers.q3_companion, step: "q3" },
    { label: "Challenge", value: answers.q4_engine,    step: "q4" },
    { label: "Ending",    value: moodLabel,             step: "q5" },
  ];

  const handleCountdownDone = useCallback(() => {
    setPhase("herewego");
    setTimeout(onLaunch, 1500);
  }, [onLaunch]);

  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-8">
        <button onClick={() => onEditStep("q5")} className="w-8 h-8 flex items-center justify-center text-white/40 text-base">←</button>
        <div className="flex-1 text-center"><span className="text-2xl">🧚</span></div>
        <div className="w-8" />
      </div>

      {/* Summary table */}
      <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {ROWS.map((row, i) => (
          <div key={row.label} className="flex items-center px-4 py-3 gap-3"
            style={{ borderBottom: i < ROWS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <span className="text-[10px] font-bold uppercase tracking-widest w-20 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{row.label}</span>
            <span className="flex-1 text-sm text-white/80 truncate">{row.value}</span>
            <button onClick={() => onEditStep(row.step)}
              className="text-[10px] px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{ background: "rgba(79,195,247,0.08)", color: "rgba(79,195,247,0.7)", border: "1px solid rgba(79,195,247,0.2)" }}>
              edit
            </button>
          </div>
        ))}
      </div>

      {/* Duration slider — shown before launch sequence begins */}
      {phase === "table" && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Story Length</label>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(79,195,247,0.12)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.25)" }}>
              {durationMinutes} min
            </span>
          </div>
          <input type="range" min={1} max={15} step={1} value={durationMinutes}
            onChange={(e) => onDurationChange(+e.target.value)}
            className="w-full cursor-pointer" style={{ accentColor: "#4fc3f7" }} />
          <div className="flex justify-between text-white/20 text-[10px] mt-1">
            <span>1 min</span>
            <span className="text-white/15">· · · · · · · · · · · · · ·</span>
            <span>15 min</span>
          </div>
        </div>
      )}

      {/* Launch sequence */}
      {phase === "table" && (
        <PrimaryButton label="Ready to hear the story?" onClick={() => setPhase("script")} />
      )}

      {(phase === "script" || phase === "countdown" || phase === "herewego") && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.6)" }}>Bluebell</p>
            <BluebellLine text={launchScript} speed={65}
              onComplete={() => { setShowReady(true); setTimeout(() => setPhase("countdown"), 600); }} />
          </div>
          {showReady && phase !== "herewego" && (
            <p className="text-white/60 text-sm italic text-center">Are you ready?</p>
          )}
          {phase === "countdown" && <LaunchCountdown onComplete={handleCountdownDone} />}
          {phase === "herewego" && (
            <p className="text-center text-lg font-semibold" style={{ color: "#4fc3f7" }}>{BLUEBELL.hereWeGo}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generating screen ────────────────────────────────────────────────────────

function GeneratingView({ heroName, worldName, seeds, durationMinutes, onDone, onError }: {
  heroName: string; worldName: string;
  seeds: StorySeeds; durationMinutes: number;
  onDone: (blocks: ScriptBlock[], summary: string, coverPrompt: string) => void;
  onError: (msg: string) => void;
}) {
  const messages = BLUEBELL.generating(heroName, worldName);
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
      body: JSON.stringify({ seeds, durationMinutes }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        onDoneRef.current(data.blocks as ScriptBlock[], data.summary ?? "", data.coverPrompt ?? "");
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        onErrorRef.current(err instanceof Error ? err.message : String(err));
      });

    return () => { controller.abort(); clearInterval(msgId); clearTimeout(longId); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-8" style={{ background: "transparent" }}>
      <div className="relative w-28 h-28 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
        <div className="absolute inset-3 rounded-full opacity-30 animate-pulse" style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
        <span className="relative text-5xl">🧚</span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-white text-base font-medium">{messages[msgIdx]}</p>
        {showLong && <p className="text-white/40 text-sm">{BLUEBELL.generatingLong}</p>}
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

// ─── Main orchestrator ────────────────────────────────────────────────────────

const INITIAL_ANSWERS: Answers = { q1_hero: "", q2_world: "", q3_companion: "", q4_engine: "", q5_mood: null };

export default function FiveQuestionPage() {
  const router = useRouter();

  const [step, setStep]                   = useState<Step>("q1");
  const [answers, setAnswers]             = useState<Answers>(INITIAL_ANSWERS);
  const [durationMinutes, setDuration]    = useState(5);
  const [scriptBlocks, setScriptBlocks]   = useState<ScriptBlock[]>([]);
  const [error, setError]                 = useState<string | null>(null);
  // Production state (used in done step)
  const [isProducing, setIsProducing]     = useState(false);
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]   = useState<Job | null>(null);
  // Story summary + cover
  const [summary, setSummary]             = useState("");
  const [coverUrl, setCoverUrl]           = useState("");
  const [coverPrompt, setCoverPrompt]     = useState("");
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [voicePool, setVoicePool] = useState<Voice[]>(PRESET_VOICE_POOL);

  useEffect(() => {
    fetchVoicePool().then(setVoicePool);
  }, []);

  const setAnswer = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const handleReset = () => {
    setStep("q1"); setAnswers(INITIAL_ANSWERS); setDuration(5);
    setScriptBlocks([]); setError(null);
    setIsProducing(false); setProductionJobId(null); setCompletedJob(null);
    setSummary(""); setCoverUrl(""); setCoverPrompt("");
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
      if (res.ok && data.imageData) {
        const url = `data:${data.mimeType ?? "image/jpeg"};base64,${data.imageData}`;
        setCoverUrl(url);
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

  const handleLaunch = useCallback(() => { setStep("generating"); setError(null); }, []);

  const handleDone = useCallback((blocks: ScriptBlock[], incomingSummary: string, incomingCoverPrompt: string) => {
    setScriptBlocks(blocks);
    setSummary(incomingSummary);
    setCoverPrompt(incomingCoverPrompt);
    setCoverUrl(""); // reset while we fetch
    writeDraft({ promptText: "", scriptBlocks: blocks, summary: incomingSummary, coverPrompt: incomingCoverPrompt, coverUrl: "" });
    setStep("done");
    if (incomingCoverPrompt) fetchCover(incomingCoverPrompt, incomingSummary);
  }, [fetchCover]);

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
      // Reuse the cover already generated right after the script (avoid regenerating it).
      const coverMatch = coverUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (coverMatch) {
        produceBody.coverImageMimeType = coverMatch[1];
        produceBody.coverImageData = coverMatch[2];
      }
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
  }, [summary, coverPrompt, coverUrl]);

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
    <div className="mx-5 mb-4 px-4 py-3 rounded-2xl text-sm"
      style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
      <p>⚠ {BLUEBELL.apiError}</p>
      <p className="text-xs mt-1 opacity-70">{error}</p>
    </div>
  ) : null;

  // ─── Step routing ───────────────────────────────────────────────────────────

  if (step === "q1") return <Q1View initialHero={answers.q1_hero} onNext={(h) => { setAnswer("q1_hero", h); setStep("q2"); }} onBack={() => router.push("/create")} />;
  if (step === "q2") return <Q2View heroName={answers.q1_hero} initialWorld={answers.q2_world} onNext={(w) => { setAnswer("q2_world", w); setStep("q3"); }} onBack={handleBack} />;
  if (step === "q3") return <Q3View heroName={answers.q1_hero} worldName={answers.q2_world} initialCompanion={answers.q3_companion} onNext={(c) => { setAnswer("q3_companion", c); setStep("q4"); }} onBack={handleBack} />;
  if (step === "q4") return <Q4View heroName={answers.q1_hero} companionName={answers.q3_companion} initialEngine={answers.q4_engine} onNext={(e) => { setAnswer("q4_engine", e); setStep("q5"); }} onBack={handleBack} />;
  if (step === "q5") return <Q5View heroName={answers.q1_hero} engineText={answers.q4_engine} onNext={(m) => { setAnswer("q5_mood", m); setStep("summary"); }} onBack={handleBack} />;

  if (step === "summary") return (
    <>
      {ErrorBanner}
      <SummaryView answers={answers} durationMinutes={durationMinutes} onDurationChange={setDuration} onEditStep={(s) => setStep(s)} onLaunch={handleLaunch} />
    </>
  );

  if (step === "generating" && seeds) return (
    <GeneratingView heroName={answers.q1_hero} worldName={answers.q2_world} seeds={seeds} durationMinutes={durationMinutes} onDone={handleDone} onError={handleGenError} />
  );

  if (step === "done") {
    // Production in progress
    if (isProducing && productionJobId) return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setIsProducing(false); setProductionJobId(null); }} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Producing Drama</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress jobId={productionJobId} onDone={handleProductionDone} onError={handleProductionError} />
        </div>
      </div>
    );

    // Production done
    if (completedJob) return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Drama Ready</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={handleReset} />
        </div>
      </div>
    );

    // Script ready — edit and produce
    return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide truncate mx-2">
              {answers.q1_hero}&apos;s Story
            </h1>
            <div className="w-8" />
          </div>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl text-xs" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
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

  return <div className="flex items-center justify-center min-h-full"><button onClick={handleReset} className="text-white/50">Start over</button></div>;
}
