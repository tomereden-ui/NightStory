"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { BLUEBELL, MOOD_LABELS } from "@/constants/bluebellScripts";
import { WORLD_OPTIONS } from "@/constants/worldOptions";
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

// ─── Types ──────────────────────────────────────────────────────────────────────────

type Step = "q1" | "q2" | "q3" | "q4" | "q5" | "summary" | "generating" | "done";

interface Answers {
  q1_hero: string;
  q2_world: string;
  q3_companion: string;
  q4_engine: string;
  q5_mood: ResolutionMood | null;
}

const DRAFT_KEY = "ns-wizard-draft-v1";

// ─── FairyFigure: animated Bluebell fairy portrait ────────────────────────────────

function FairyFigure({ size = 80 }: { size?: number }) {
  return (
    <div style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <style>{`
        @keyframes _owlFloat {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          30% { transform: translateY(-7px) rotate(-2deg); }
          70% { transform: translateY(-4px) rotate(1.5deg); }
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
        alt="Bluebell"
        style={{
          width: size,
          height: size,
          position: "relative",
          zIndex: 1,
          borderRadius: "50%",
          animation: "_owlFloat 4s ease-in-out infinite",
          filter: "drop-shadow(0 0 10px rgba(79,195,247,0.5)) drop-shadow(0 2px 8px rgba(167,139,250,0.4))",
        }}
      />
      {/* Sparkles */}
      <span style={{ position: "absolute", top: 0, right: -size * 0.18, fontSize: size * 0.22, zIndex: 2, animation: "_owlSparkle 2.4s ease-in-out infinite", lineHeight: 1 }}>✨</span>
      <span style={{ position: "absolute", bottom: size * 0.05, left: -size * 0.22, fontSize: size * 0.16, zIndex: 2, animation: "_owlSparkle 3s ease-in-out infinite 0.8s", lineHeight: 1 }}>⭐</span>
    </div>
  );
}

// ─── BluebellLine: progressive word-by-word reveal ───────────────────────────────

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

// ─── LaunchCountdown: 3-second animated pause ───────────────────────────────────

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

// ─── Shared primitives ───────────────────────────────────────────────────────

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

// ─── IllustratedCard ────────────────────────────────────────────────────────────────

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
  const [c1, c2] = cardPalette(label);

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
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1"
        style={{
          background: `radial-gradient(ellipse at 40% 35%, ${c1}55 0%, ${c2}33 50%, rgba(6,9,22,0.97) 100%)`,
          opacity: imgLoaded ? 0 : 1,
          transition: "opacity 0.4s ease",
          pointerEvents: "none",
        }}
      >
        <div style={{
          position: "absolute", width: 64, height: 64, borderRadius: "50%",
          background: `radial-gradient(circle, ${c1}44, transparent 70%)`,
          filter: "blur(8px)",
        }} />
        <span className="text-fs-display relative" style={{ filter: `drop-shadow(0 0 20px ${c1}) drop-shadow(0 0 8px ${c2})` }}>{emoji}</span>
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
        className="w-full rounded-xl px-4 py-3 text-fs-body text-white placeholder-white/25 outline-none transition-colors"
        style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)"}` }}
        onFocus={(e) => (e.currentTarget.style.borderColor = over ? "rgba(236,72,153,0.5)" : "rgba(79,195,247,0.4)")}
        onBlur={(e)  => (e.currentTarget.style.borderColor = over ? "rgba(236,72,153,0.5)" : "rgba(255,255,255,0.12)")} />
      {over && <p className="text-fs-body mt-1.5" style={{ color: "#EC4899" }}>{BLUEBELL.q4Hint}</p>}
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

// ─── SkipLink: standalone skip (shown when no confirm is visible yet) ─────────────

function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <button onClick={onSkip}
      className="text-center text-fs-body w-full py-1"
      style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.01em" }}>
      Skip this step →
    </button>
  );
}

// ─── ConfirmRow: skip (left ghost) + confirm (right primary) on same row ──────

function ConfirmRow({ confirmLabel, onConfirm, disabled, onSkip }: {
  confirmLabel: string; onConfirm: () => void; disabled?: boolean; onSkip?: () => void;
}) {
  return (
    <div className="flex gap-2">
      {onSkip && (
        <button onClick={onSkip}
          className="flex-shrink-0 py-4 px-5 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.35)" }}>
          Skip →
        </button>
      )}
      <button onClick={onConfirm} disabled={disabled}
        className="flex-1 py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
        style={!disabled
          ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }
          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {confirmLabel}
      </button>
    </div>
  );
}

// ─── QuestionShell ────────────────────────────────────────────────────────────────────

function QuestionShell({ onBack, onReset, children, bluebellText, bluebellSpeed, onBluebellComplete, audioUrl }: {
  onBack?: () => void; onReset?: () => void; children: React.ReactNode;
  bluebellText: string; bluebellSpeed?: number; onBluebellComplete?: () => void;
  audioUrl?: string;
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
      <div className="flex items-center mb-8">
        {onBack
          ? <BackButton onClick={onBack} />
          : <div className="w-8" />
        }
        <div className="flex-1 flex justify-center">
          <FairyFigure size={52} />
        </div>
        {onReset ? (
          <button onClick={onReset}
            className="text-fs-body transition-all active:scale-95"
            style={{ color: "rgba(255,255,255,0.22)" }}>
            Start over
          </button>
        ) : <div className="w-16" />}
      </div>
      <div className="mb-7">
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

// ─── Q1 — Hero identity ─────────────────────────────────────────────────────────────────

type Q1Card = "own" | "magical" | "stranger" | "surprise";

function Q1View({ initialHero, onNext, onBack, onSkip, onReset, optionImages, audioUrl, childName, childAvatarUrl }: { initialHero: string; onNext: (hero: string) => void; onBack?: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string; childName?: string; childAvatarUrl?: string }) {
  const [selectedCard, setSelectedCard] = useState<Q1Card | null>(null);
  const [textVal, setTextVal]           = useState(initialHero);
  const [magicChip, setMagicChip]       = useState<string | null>(MAGICAL_NAME_CHIPS.includes(initialHero) ? initialHero : null);
  const [surpriseHero, setSurpriseHero] = useState<{ figure: string; name: string } | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!initialHero) return;
    if (MAGICAL_NAME_CHIPS.includes(initialHero)) { setSelectedCard("magical"); setMagicChip(initialHero); }
    else { setSelectedCard("own"); setTextVal(initialHero); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doConfirm = (displayName: string, heroStr: string) => {
    if (!displayName.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setTransitionMsg(BLUEBELL.q1Confirm(displayName));
    setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(heroStr.trim()); }, 1500);
  };

  const handleSurprise = () => {
    const hero = pickRandom(SURPRISE_HEROES);
    setSurpriseHero(hero);
    setSelectedCard("surprise");
  };

  const canConfirm = (() => {
    if (selectedCard === "own")     return childName ? true : !!textVal.trim();
    if (selectedCard === "magical") return !!magicChip;
    if (selectedCard === "stranger") return !!textVal.trim();
    if (selectedCard === "surprise") return !!surpriseHero;
    return false;
  })();

  const handleConfirm = () => {
    if (!selectedCard) return;
    if (selectedCard === "own")     return doConfirm(childName || textVal, childName || textVal);
    if (selectedCard === "magical") return magicChip && doConfirm(magicChip, magicChip);
    if (selectedCard === "stranger") return doConfirm(textVal, textVal);
    if (selectedCard === "surprise" && surpriseHero) {
      return doConfirm(surpriseHero.name, `${surpriseHero.figure} named ${surpriseHero.name}`);
    }
  };

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <FairyFigure size={80} />
      <p className="text-white text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} bluebellText={BLUEBELL.q1} audioUrl={audioUrl}>
      <div className="flex flex-col gap-3">

        <div className="grid grid-cols-2 gap-2">
          <IllustratedCard
            label={childName || "Your own name"}
            emoji="👤"
            imageUrl={childAvatarUrl || optionImages["hero-own"]}
            selected={selectedCard === "own"}
            onClick={() => setSelectedCard("own")}
          />
          <IllustratedCard label="A magical name"   emoji="✨"  imageUrl={optionImages["hero-magical"]}  selected={selectedCard === "magical"}  onClick={() => setSelectedCard("magical")} />
          <IllustratedCard label="A brave stranger" emoji="🗺️" imageUrl={optionImages["hero-stranger"]} selected={selectedCard === "stranger"} onClick={() => setSelectedCard("stranger")} />
          <IllustratedCard label="Surprise me!"     emoji="🎲"  imageUrl={optionImages["hero-surprise"]} selected={selectedCard === "surprise"} onClick={handleSurprise} />
        </div>

        {selectedCard === "own" && !childName && (
          <>
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={BLUEBELL.q1TextOwn} autoFocus onSubmit={handleConfirm} />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            <ExampleChips examples={["Finn", "Zara", "Milo", "Wren"]} onTap={(v) => { setTextVal(v); setValidationError(""); }} />
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
            <StoryInput value={textVal} onChange={(v) => { setTextVal(v); setValidationError(""); }} placeholder={BLUEBELL.q1TextStranger} autoFocus onSubmit={handleConfirm} />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            <ExampleChips examples={["Ember the fox", "Sir Bravely", "Captain Nimbus"]} onTap={(v) => { setTextVal(v); setValidationError(""); }} />
          </>
        )}

        {selectedCard === "surprise" && surpriseHero && (
          <div className="rounded-2xl px-5 py-4 text-center"
            style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)" }}>
            <p className="text-white/40 text-fs-body mb-0.5">Your hero is…</p>
            <p className="text-white text-fs-title font-bold" style={{ color: "#4fc3f7" }}>{surpriseHero.name}</p>
            <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.38)", fontStyle: "italic" }}>{surpriseHero.figure}</p>
            <button onClick={handleSurprise} className="text-white/25 text-fs-body mt-3 block w-full">Try another 🎲</button>
          </div>
        )}

        <ConfirmRow
          confirmLabel={selectedCard === "own" && childName ? `Yes, I'm ${childName}!` : "This is my hero!"}
          onConfirm={handleConfirm}
          disabled={!canConfirm || !selectedCard}
          onSkip={onSkip}
        />

      </div>
    </QuestionShell>
  );
}

// ─── Q2 — Story world ───────────────────────────────────────────────────────────────────

function Q2View({ heroName, initialWorld, onNext, onBack, onSkip, onReset, optionImages, audioUrl }: { heroName: string; initialWorld: string; onNext: (world: string) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string }) {
  const [selected, setSelected] = useState(initialWorld);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");

  const confirm = (world: string) => {
    setTransitionMsg(BLUEBELL.q2Confirm(world)); setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(world); }, 1500);
  };

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <FairyFigure size={80} />
      <p className="text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} bluebellText={BLUEBELL.q2(heroName)} audioUrl={audioUrl}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {WORLD_OPTIONS.map((w) => {
            const isSel = selected === w.label;
            return (
              <IllustratedCard
                key={w.id}
                label={w.label}
                emoji={w.emoji}
                imageUrl={optionImages[`world-${w.id}`]}
                selected={isSel}
                onClick={() => setSelected(w.label)}
              />
            );
          })}
        </div>
        <OptionPill label="Surprise me!" emoji="🎲" onClick={() => setSelected(pickRandom(WORLD_OPTIONS).label)} />
        <ConfirmRow
          confirmLabel="This is the world!"
          onConfirm={() => selected && confirm(selected)}
          disabled={!selected}
          onSkip={onSkip}
        />
      </div>
    </QuestionShell>
  );
}

// ─── Q3 — Companion ────────────────────────────────────────────────────────────────────

type Q3CompanionType = "friend" | "pet" | "creature" | "family";

const COMPANION_TYPES: { id: Q3CompanionType; label: string; geminiLabel: string; emoji: string; surpriseNames: string[] }[] = [
  { id: "friend",   label: "Best friend",       geminiLabel: "best friend",      emoji: "👫", surpriseNames: ["Mia", "Jake", "Sam", "Theo", "Lily", "Omar", "Priya"] },
  { id: "pet",      label: "A pet",              geminiLabel: "pet",              emoji: "🐾", surpriseNames: ["Biscuit", "Pepper", "Mochi", "Pebble", "Rolo", "Toasty", "Noodle"] },
  { id: "creature", label: "A magical creature", geminiLabel: "magical creature", emoji: "🦄", surpriseNames: ["Nimbus", "Ember", "Glimmer", "Pip", "Nova", "Wisp", "Cinder"] },
  { id: "family",   label: "A family member",    geminiLabel: "family member",    emoji: "👨‍👩‍👧", surpriseNames: ["Rosa", "Leo", "Nana", "my brother", "my sister", "Grandpa Joe", "Auntie Bea"] },
];

function Q3View({ heroName, worldName, initialCompanion, onNext, onBack, onSkip, onReset, optionImages, audioUrl }: { heroName: string; worldName: string; initialCompanion: string; onNext: (c: string) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string }) {
  const [selectedType, setSelectedType] = useState<Q3CompanionType | null>(null);
  const [nameVal, setNameVal]           = useState("");
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const [transitioning, setTransitioning]   = useState(false);
  const [transitionMsg, setTransitionMsg]   = useState("");

  const buildCompanionString = (type: Q3CompanionType, name: string): string => {
    const ct = COMPANION_TYPES.find((t) => t.id === type)!;
    return name.trim() ? `a ${ct.geminiLabel} named ${name.trim()}` : `a ${ct.geminiLabel}`;
  };

  const confirm = (type: Q3CompanionType, name: string) => {
    const companion = buildCompanionString(type, name);
    setTransitionMsg(BLUEBELL.q3Confirm(name.trim() || COMPANION_TYPES.find((t) => t.id === type)!.label));
    setTransitioning(true);
    setTimeout(() => { setTransitioning(false); onNext(companion); }, 1500);
  };

  // Load contextual name suggestions when companion type changes
  useEffect(() => {
    if (!selectedType) { setSuggestedNames([]); return; }
    const ct = COMPANION_TYPES.find((t) => t.id === selectedType)!;
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
  }, [selectedType, heroName, worldName]);

  if (transitioning) return (
    <div className="flex flex-col min-h-full items-center justify-center px-5">
      <FairyFigure size={80} />
      <p className="text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{transitionMsg}</p>
    </div>
  );

  return (
    <QuestionShell onBack={onBack} onReset={onReset} bluebellText={BLUEBELL.q3(worldName, heroName)} audioUrl={audioUrl}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {COMPANION_TYPES.map((ct) => (
            <IllustratedCard
              key={ct.id}
              label={ct.label}
              emoji={ct.emoji}
              imageUrl={optionImages[`companion-${ct.id}`]}
              selected={selectedType === ct.id}
              onClick={() => { setSelectedType(ct.id); setNameVal(""); }}
            />
          ))}
        </div>

        <OptionPill label="Surprise me!" emoji="🎲" onClick={() => {
          const randomType = pickRandom(COMPANION_TYPES);
          setSelectedType(randomType.id);
          setNameVal(pickRandom(randomType.surpriseNames));
        }} />

        {selectedType && (
          <>
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
              Give them a name — or leave it blank and Bluebell will choose!
            </p>
            <input
              autoFocus
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm(selectedType, nameVal)}
              placeholder="Name (optional)"
              className="w-full rounded-xl px-4 py-3 text-fs-body text-white placeholder-white/25 outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            />
            {suggestedNames.length > 0 && (
              <ExampleChips examples={suggestedNames} onTap={(v) => setNameVal(v)} />
            )}
            <ConfirmRow
              confirmLabel="This is the companion!"
              onConfirm={() => confirm(selectedType, nameVal)}
              onSkip={onSkip}
            />
          </>
        )}

        {!selectedType && (
          <>
            <p className="text-fs-body text-center" style={{ color: "rgba(255,255,255,0.3)" }}>{BLUEBELL.q3Nudge}</p>
            {onSkip && <SkipLink onSkip={onSkip} />}
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q4 — Dramatic engine ───────────────────────────────────────────────────────────

type Q4Category = "funny" | "spooky" | "weird" | "delicious";
type Q4Phase = "input" | "reaction1" | "reaction2";

const Q4_CATEGORIES: { id: Q4Category; label: string; emoji: string; placeholder: string; hint: string; examples: string[] }[] = [
  { id: "funny",     label: "Funny",      emoji: "😂", placeholder: "like... giant sneezing broccoli",       hint: "(e.g. a hiccuping rainbow machine, a cloud that laughs at everything)", examples: ["giant sneezing broccoli", "a hiccuping rainbow machine", "a cloud that laughs at everything"] },
  { id: "spooky",   label: "Spooky-fun", emoji: "👻", placeholder: "like... shadows that giggle",            hint: "(e.g. a door that whispers your name backwards, footsteps with no feet)",  examples: ["shadows that giggle", "footsteps with no feet", "a door that whispers your name"] },
  { id: "weird",    label: "Very weird",  emoji: "🌀", placeholder: "like... invisible cheese",              hint: "(e.g. mountains that hum lullabies, clocks that run upside down)",         examples: ["invisible cheese", "mountains that hum lullabies", "clocks that run upside down"] },
  { id: "delicious", label: "Delicious",  emoji: "🍫", placeholder: "like... a river of hot chocolate",      hint: "(e.g. flowers that taste like candy floss, rain made of lemonade)",        examples: ["a river of hot chocolate", "candy floss flowers", "rain made of lemonade"] },
];

function Q4View({ heroName, companionName, initialEngine, onNext, onBack, onSkip, onReset, optionImages, audioUrl }: { heroName: string; companionName: string; initialEngine: string; onNext: (e: string) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string }) {
  const [selectedCat, setSelectedCat] = useState<Q4Category | null>(null);
  const [textVal, setTextVal]         = useState(initialEngine);
  const [phase, setPhase]             = useState<Q4Phase>("input");
  const [confirmedEngine, setConfirmedEngine] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (initialEngine) { setSelectedCat("funny"); setTextVal(initialEngine); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = (engine: string) => {
    if (!engine.trim()) { setValidationError(BLUEBELL.emptyError); return; }
    setConfirmedEngine(engine.trim());
    setTimeout(() => setPhase("reaction1"), 1500);
  };

  if (phase === "reaction1") return (
    <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
      <FairyFigure size={72} />
      <BluebellLine text={BLUEBELL.q4Reaction1} speed={90} onComplete={() => setTimeout(() => setPhase("reaction2"), 600)} />
    </div>
  );

  if (phase === "reaction2") return (
    <div className="flex flex-col min-h-full items-center justify-center px-5 gap-5">
      <FairyFigure size={72} />
      <p className="text-fs-subtitle font-light text-center leading-relaxed" style={{ color: "#4fc3f7" }}>{BLUEBELL.q4Confirm(confirmedEngine)}</p>
      <AutoAdvance delay={1200} onAdvance={() => onNext(confirmedEngine)} />
    </div>
  );

  const activeCat = Q4_CATEGORIES.find((c) => c.id === selectedCat);

  return (
    <QuestionShell onBack={onBack} onReset={onReset} bluebellText={BLUEBELL.q4(companionName, heroName)} audioUrl={audioUrl}>
      <div className="flex flex-col gap-3">

        <div className="grid grid-cols-2 gap-2">
          {Q4_CATEGORIES.map((c) => (
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
              onSubmit={() => confirm(textVal)} />
            {validationError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{validationError}</p>}
            <ExampleChips
              examples={activeCat.examples}
              onTap={(v) => { setTextVal(v); setValidationError(""); }}
            />
            <ConfirmRow
              confirmLabel="This is the challenge!"
              onConfirm={() => confirm(textVal)}
              disabled={!textVal.trim()}
              onSkip={onSkip}
            />
          </>
        )}

        {!selectedCat && (
          <>
            <OptionPill label="Surprise me!" emoji="🎲" onClick={() => {
              const cat = pickRandom(Q4_CATEGORIES);
              setSelectedCat(cat.id);
              setTextVal(pickRandom(SURPRISE_ENGINES));
            }} />
            {onSkip && <SkipLink onSkip={onSkip} />}
          </>
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Q5 — Resolution mood ───────────────────────────────────────────────────────────────

function Q5View({ heroName, engineText, onNext, onBack, onSkip, onReset, optionImages, audioUrl }: { heroName: string; engineText: string; onNext: (mood: ResolutionMood) => void; onBack: () => void; onSkip?: () => void; onReset?: () => void; optionImages: Record<string, string>; audioUrl?: string }) {
  const MOODS: { id: ResolutionMood; label: string; emoji: string; isBedtime?: boolean }[] = [
    { id: "brave",     label: "Super brave",          emoji: "🦱" },
    { id: "laughing",  label: "Laughing so much",      emoji: "😂" },
    { id: "surprised", label: "Wonderfully surprised", emoji: "🌟" },
    { id: "sleepy",    label: "Warm and sleepy",        emoji: "🌙", isBedtime: true },
  ];

  const [selectedMood, setSelectedMood] = useState<ResolutionMood | null>(null);

  return (
    <QuestionShell onBack={onBack} onReset={onReset} bluebellText={BLUEBELL.q5(engineText, heroName)} audioUrl={audioUrl}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          {MOODS.map((m) => (
            <IllustratedCard
              key={m.id}
              label={m.label}
              emoji={m.emoji}
              imageUrl={optionImages[`mood-${m.id}`]}
              selected={selectedMood === m.id}
              onClick={() => setSelectedMood(m.id)}
              badge={m.isBedtime
                ? <span className="block text-fs-body font-bold uppercase tracking-widest mb-0.5" style={{ color: "#FBB824" }}>bedtime ❖</span>
                : undefined
              }
            />
          ))}
        </div>
        <OptionPill label="Surprise me!" emoji="🎲" onClick={() => setSelectedMood(pickRandom(MOODS).id)} />
        {selectedMood ? (
          <ConfirmRow
            confirmLabel="This is the ending!"
            onConfirm={() => onNext(selectedMood)}
            onSkip={onSkip}
          />
        ) : (
          onSkip && <SkipLink onSkip={onSkip} />
        )}
      </div>
    </QuestionShell>
  );
}

// ─── Summary screen ─────────────────────────────────────────────────────────────────────

type SummaryPhase = "table" | "script" | "countdown" | "herewego";

function SummaryView({ answers, durationMinutes, onDurationChange, onEditStep, onLaunch, onReset }: {
  answers: Answers;
  durationMinutes: number;
  onDurationChange: (v: number) => void;
  onEditStep: (step: Step) => void;
  onLaunch: () => void;
  onReset?: () => void;
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
        <BackButton onClick={() => onEditStep("q5")} />
        <div className="flex-1 flex justify-center"><FairyFigure size={52} /></div>
        {onReset ? (
          <button onClick={onReset}
            className="text-fs-body transition-all active:scale-95"
            style={{ color: "rgba(255,255,255,0.22)" }}>
            Start over
          </button>
        ) : <div className="w-16" />}
      </div>

      <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {ROWS.map((row, i) => (
          <div key={row.label} className="flex items-center px-4 py-3 gap-3"
            style={{ borderBottom: i < ROWS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <span className="text-fs-body font-bold uppercase tracking-widest w-20 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{row.label}</span>
            <span className="flex-1 text-fs-body text-white/80 truncate">{row.value}</span>
            <button onClick={() => onEditStep(row.step)}
              className="text-fs-body px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{ background: "rgba(79,195,247,0.08)", color: "rgba(79,195,247,0.7)", border: "1px solid rgba(79,195,247,0.2)" }}>
              edit
            </button>
          </div>
        ))}
      </div>

      {phase === "table" && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-white/40 text-fs-body font-bold uppercase tracking-widest">Story Length</label>
            <span className="text-fs-body font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(79,195,247,0.12)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.25)" }}>
              {durationMinutes} min
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { value: 3, icon: "⚡", label: "Short",  desc: "~3 min" },
              { value: 5, icon: "🌙", label: "Medium", desc: "~5 min" },
              { value: 8, icon: "✨", label: "Long",   desc: "~8 min" },
            ].map((p) => {
              const sel = durationMinutes === p.value;
              return (
                <button key={p.value} onClick={() => onDurationChange(p.value)}
                  className="flex flex-col items-center gap-0.5 py-2.5 rounded-2xl transition-all active:scale-[0.97]"
                  style={sel
                    ? { background: "rgba(79,195,247,0.14)", border: "1.5px solid rgba(79,195,247,0.5)", color: "#4fc3f7" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
                  <span className="text-fs-heading">{p.icon}</span>
                  <span className="text-fs-body font-semibold">{p.label}</span>
                  <span className="text-fs-body" style={{ color: sel ? "rgba(79,195,247,0.7)" : "rgba(255,255,255,0.3)" }}>{p.desc}</span>
                </button>
              );
            })}
          </div>
          <input type="range" min={1} max={15} step={1} value={durationMinutes}
            onChange={(e) => onDurationChange(+e.target.value)}
            className="w-full cursor-pointer" style={{ accentColor: "#4fc3f7" }} />
          <div className="flex justify-between text-white/20 text-fs-body mt-1">
            <span>1 min</span>
            <span className="text-white/15">· · · · · · · · · · · · · ·</span>
            <span>15 min</span>
          </div>
        </div>
      )}

      {phase === "table" && (
        <button
          onClick={() => setPhase("script")}
          className="w-full py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }}>
          Ready to hear the story?
        </button>
      )}

      {(phase === "script" || phase === "countdown" || phase === "herewego") && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-fs-body font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.6)" }}>Bluebell</p>
            <BluebellLine text={launchScript} speed={65}
              onComplete={() => { setShowReady(true); setTimeout(() => setPhase("countdown"), 600); }} />
          </div>
          {showReady && phase !== "herewego" && (
            <p className="text-white/60 text-fs-body italic text-center">Are you ready?</p>
          )}
          {phase === "countdown" && <LaunchCountdown onComplete={handleCountdownDone} />}
          {phase === "herewego" && (
            <p className="text-center text-fs-heading font-semibold" style={{ color: "#4fc3f7" }}>{BLUEBELL.hereWeGo}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generating screen ────────────────────────────────────────────────────────────────

function GeneratingView({ heroName, worldName, seeds, durationMinutes, onDone, onError }: {
  heroName: string; worldName: string;
  seeds: StorySeeds; durationMinutes: number;
  onDone: (blocks: ScriptBlock[], summary: string, coverPrompt: string, characters?: Record<string, StoryCharacterInfo>, scenes?: import("@/types").StoryScene[]) => void;
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
        onDoneRef.current(data.blocks as ScriptBlock[], data.summary ?? "", data.coverPrompt ?? "", data.characters as Record<string, StoryCharacterInfo> | undefined, data.scenes as import("@/types").StoryScene[] | undefined);
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
        <div className="relative z-10"><FairyFigure size={100} /></div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-white text-fs-heading font-medium">{messages[msgIdx]}</p>
        {showLong && <p className="text-white/40 text-fs-body">{BLUEBELL.generatingLong}</p>}
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

// ─── Main orchestrator ────────────────────────────────────────────────────────────────────

const INITIAL_ANSWERS: Answers = { q1_hero: "", q2_world: "", q3_companion: "", q4_engine: "", q5_mood: null };

export interface StoryCharacterInfo { type: "child" | "adult" | "animal" | "narrator"; visualDescription: string; }
export type FiveQuestionCompleteData = { blocks: ScriptBlock[]; summary: string; coverPrompt: string; characters?: Record<string, StoryCharacterInfo>; scenes?: import("@/types").StoryScene[] };

export function FiveQuestionFlow({ onComplete, onGenerating, childName, childAvatarUrl }: { onComplete?: (data: FiveQuestionCompleteData) => void; onGenerating?: () => void; childName?: string; childAvatarUrl?: string } = {}) {
  const router = useRouter();
  const { language, t } = useLanguage();

  const [step, setStep]                   = useState<Step>("q1");
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
  const LS_KEY = "ns-option-images-v5";
  const [optionImages, setOptionImages] = useState<Record<string, string>>({});
  const [imagesGenerating, setImagesGenerating] = useState(false);

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setOptionImages(JSON.parse(cached) as Record<string, string>);
    } catch { /* ignore */ }

    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step?: Step; answers?: Answers; durationMinutes?: number };
        const hasContent = parsed.answers && Object.values(parsed.answers).some((v) => v);
        if (hasContent && parsed.answers) {
          setAnswers(parsed.answers);
          if (parsed.durationMinutes) setDuration(parsed.durationMinutes);
          const safestep = parsed.step;
          if (safestep && !["generating", "done"].includes(safestep)) setStep(safestep);
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
      try {
        const res = await fetch(`/api/admin/seed-bluebell-audio?lang=${language}`);
        if (!res.ok) return;
        const { missing, existingAudioUrls } = await res.json() as {
          missing: string[];
          existingAudioUrls: Record<string, string>;
        };

        if (existingAudioUrls && Object.keys(existingAudioUrls).length > 0) {
          setQuestionAudios((prev) => ({ ...prev, ...existingAudioUrls }));
        }

        if (!missing?.length) return;

        const ordered = ["q1", "q2", "q3", "q4", "q5"].filter((k) => missing.includes(k));
        for (const key of ordered) {
          if (cancelled) return;
          try {
            const genRes = await fetch(`/api/admin/seed-bluebell-audio?lang=${language}&key=${key}`, { method: "POST" });
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
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    async function seedImages() {
      try {
        const res = await fetch("/api/admin/seed-create-images");
        if (!res.ok) { console.warn("[seedImages] GET failed", res.status); return; }
        const { missing, existingImageUrls } = await res.json() as {
          missing: { key: string; prompt: string }[];
          existingImageUrls: Record<string, string>;
        };

        const saveToLS = (imgs: Record<string, string>) => {
          try { localStorage.setItem(LS_KEY, JSON.stringify(imgs)); } catch { /* ignore */ }
        };

        if (existingImageUrls && Object.keys(existingImageUrls).length > 0) {
          setOptionImages((prev) => {
            const next = { ...prev, ...existingImageUrls };
            saveToLS(next);
            return next;
          });
        }

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
                  setOptionImages((prev) => {
                    const next = { ...prev, [imageKey]: cachedUrl };
                    saveToLS(next);
                    return next;
                  });
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

  const handleDone = useCallback((blocks: ScriptBlock[], incomingSummary: string, incomingCoverPrompt: string, characters?: Record<string, StoryCharacterInfo>, scenes?: import("@/types").StoryScene[]) => {
    setScriptBlocks(blocks);
    setSummary(incomingSummary);
    setCoverPrompt(incomingCoverPrompt);
    setCoverUrl("");
    writeDraft({ promptText: "", scriptBlocks: blocks, summary: incomingSummary, coverPrompt: incomingCoverPrompt, coverUrl: "", scenes });
    if (onComplete) {
      onComplete({ blocks, summary: incomingSummary, coverPrompt: incomingCoverPrompt, characters, scenes });
    } else {
      if (incomingCoverPrompt) fetchCover(incomingCoverPrompt, incomingSummary);
      router.push("/studio");
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
    <div className="mx-5 mb-4 px-4 py-3 rounded-2xl text-fs-body"
      style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
      <p>⚠ {BLUEBELL.apiError}</p>
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

  const resetProp = hasProgress ? handleReset : undefined;

  if (step === "q1") return <>{GeneratingBadge}<Q1View initialHero={answers.q1_hero} onNext={(h) => { setAnswer("q1_hero", h); nextOrSummary("q2"); }} onBack={editingFromSummary ? backToSummary : (onComplete ? undefined : () => router.push("/create"))} onSkip={() => skipOrSummary("q2", () => { if (!answers.q1_hero) setAnswer("q1_hero", pickRandom(SURPRISE_HERO_NAMES)); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q1} childName={childName} childAvatarUrl={childAvatarUrl} /></>;
  if (step === "q2") return <>{GeneratingBadge}<Q2View heroName={answers.q1_hero} initialWorld={answers.q2_world} onNext={(w) => { setAnswer("q2_world", w); nextOrSummary("q3"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("q3", () => { if (!answers.q2_world) setAnswer("q2_world", pickRandom(WORLD_OPTIONS).label); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q2} /></>;
  if (step === "q3") return <>{GeneratingBadge}<Q3View heroName={answers.q1_hero} worldName={answers.q2_world} initialCompanion={answers.q3_companion} onNext={(c) => { setAnswer("q3_companion", c); nextOrSummary("q4"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("q4", () => { if (!answers.q3_companion) setAnswer("q3_companion", pickRandom(SURPRISE_COMPANIONS)); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q3} /></>;
  if (step === "q4") return <>{GeneratingBadge}<Q4View heroName={answers.q1_hero} companionName={answers.q3_companion} initialEngine={answers.q4_engine} onNext={(e) => { setAnswer("q4_engine", e); nextOrSummary("q5"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("q5", () => { if (!answers.q4_engine) setAnswer("q4_engine", pickRandom(SURPRISE_ENGINES)); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q4} /></>;
  if (step === "q5") return <>{GeneratingBadge}<Q5View heroName={answers.q1_hero} engineText={answers.q4_engine} onNext={(m) => { setAnswer("q5_mood", m); nextOrSummary("summary"); }} onBack={editingFromSummary ? backToSummary : handleBack} onSkip={() => skipOrSummary("summary", () => { if (!answers.q5_mood) setAnswer("q5_mood", "sleepy"); })} onReset={resetProp} optionImages={optionImages} audioUrl={questionAudios.q5} /></>;

  if (step === "summary") return (
    <>
      {ErrorBanner}
      <SummaryView answers={answers} durationMinutes={durationMinutes} onDurationChange={setDuration} onEditStep={(s) => { setEditingFromSummary(true); setStep(s); }} onLaunch={handleLaunch} onReset={handleReset} />
    </>
  );

  if (step === "generating" && seeds) return (
    <GeneratingView heroName={answers.q1_hero} worldName={answers.q2_world} seeds={seeds} durationMinutes={durationMinutes} onDone={handleDone} onError={handleGenError} />
  );

  if (step === "done") {
    if (isProducing && productionJobId) return (
      <div className="min-h-full" style={{ background: "transparent" }}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <BackButton onClick={() => { setIsProducing(false); setProductionJobId(null); }} />
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">Producing Drama</h1>
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
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">Drama Ready</h1>
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
              {answers.q1_hero}&apos;s Story
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
