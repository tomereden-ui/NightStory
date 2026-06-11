"use client";

import { useState, useEffect, useRef } from "react";

// Speech Recognition API types (not always in TS dom lib)
interface ISpeechRecognitionEvent {
  results: { length: number; [index: number]: { [index: number]: { transcript: string } } };
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

function getSpeechRecognitionAPI(): ISpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] as ISpeechRecognitionConstructor | undefined) ??
    (w["webkitSpeechRecognition"] as ISpeechRecognitionConstructor | undefined) ??
    null;
}

interface QuickCreateTabProps {
  onGenerate: (promptText: string, durationMinutes: number) => void;
  generating: boolean;
  language: string;
}

interface WorldCard {
  id: string;
  emoji: string;
  label: string;
  character: string;
  setting: string;
  bg: string;
  question: string;
}

interface Mood {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  tone: string;
  accent: string;
}

const WORLDS: WorldCard[] = [
  { id: "astronaut", emoji: "🚀", label: "Astronaut on the Moon", character: "Astronaut", setting: "on the Moon", bg: "linear-gradient(160deg,#0f0c29,#302b63)", question: "What one thing from your bedroom did the astronaut secretly pack in the spaceship?" },
  { id: "dinosaur",  emoji: "🦕", label: "Dinosaur in the Kitchen", character: "Dinosaur", setting: "in the Kitchen", bg: "linear-gradient(160deg,#0d2e10,#1d5c1a)", question: "What is the weirdest food the dinosaur is trying to cook tonight?" },
  { id: "bear",      emoji: "🐻", label: "Bear in the Jungle", character: "Bear", setting: "in the Jungle", bg: "linear-gradient(160deg,#2e1a00,#6b3a0f)", question: "What magical thing did the bear discover hidden deep in the jungle?" },
  { id: "mermaid",   emoji: "🧜", label: "Mermaid in the Deep Sea", character: "Mermaid", setting: "in the Deep Sea", bg: "linear-gradient(160deg,#002147,#0a4a7a)", question: "What treasure from the land did the mermaid bring down to the ocean?" },
  { id: "wizard",    emoji: "🧙", label: "Wizard at Magic School", character: "Wizard", setting: "in a Magic School", bg: "linear-gradient(160deg,#1a004a,#3b0080)", question: "What spell went hilariously wrong at magic school today?" },
  { id: "fox",       emoji: "🦊", label: "Fox in the Snowy Forest", character: "Fox", setting: "in the Snowy Forest", bg: "linear-gradient(160deg,#0f1626,#1e3a5a)", question: "What mysterious thing did the fox find buried under the snow?" },
];

const MOODS: Mood[] = [
  { id: "adventure", emoji: "🚀", label: "Adventure & Mystery", desc: "Fast-paced · riddle-solving", tone: "thrilling, adventurous, and full of mystery and exciting plot twists", accent: "#00D4FF" },
  { id: "silly",     emoji: "😂", label: "Silly & Funny",        desc: "Absurd humor · nonsense",    tone: "silly, funny, and full of absurd humor and unexpected nonsense moments",     accent: "#F59E0B" },
  { id: "calm",      emoji: "🌙", label: "Calm & Dreamy",        desc: "Slow-paced · soothing",       tone: "calm, dreamy, gently poetic, and soothing with soft ambient descriptions",   accent: "#8B5CF6" },
];

// Step indicator dots
function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className="rounded-full transition-all"
          style={
            s === step
              ? { width: 20, height: 6, background: "#F59E0B" }
              : s < step
              ? { width: 6, height: 6, background: "rgba(245,158,11,0.5)" }
              : { width: 6, height: 6, background: "rgba(255,255,255,0.15)" }
          }
        />
      ))}
    </div>
  );
}

export default function QuickCreateTab({ onGenerate, generating, language }: QuickCreateTabProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedWorld, setSelectedWorld] = useState<WorldCard | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [personalStamp, setPersonalStamp] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    setHasSpeechSupport(!!getSpeechRecognitionAPI());
  }, []);

  const startRecording = () => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === "he" ? "he-IL" : "en-US";

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setPersonalStamp(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const handleCreate = () => {
    if (!selectedWorld || !selectedMood || !personalStamp.trim()) return;

    const prompt = `A ${selectedMood.tone} children's story featuring a ${selectedWorld.character} ${selectedWorld.setting}.

Central plot twist — build the entire story around this:
"${selectedWorld.question}"
Answer: "${personalStamp.trim()}"

Weave this answer naturally into a surprising, emotionally satisfying arc.`;

    onGenerate(prompt, 3);
  };

  // ─── Step 1: World Picker ───────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex flex-col">
        <StepDots step={1} />
        <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest text-center mb-5">
          {language === "he" ? "בחר עולם" : "Pick a World"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {WORLDS.map((world) => (
            <button
              key={world.id}
              onClick={() => {
                setSelectedWorld(world);
                setStep(2);
              }}
              className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all active:scale-95"
              style={{ height: 140, background: world.bg }}
            >
              <span className="text-4xl mb-2">{world.emoji}</span>
              {/* Label overlay */}
              <div
                className="absolute bottom-0 left-0 right-0 px-2 py-2"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
              >
                <span className="text-white text-[11px] font-semibold leading-tight block text-center">
                  {world.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step 2: Mood Picker ────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="flex flex-col">
        <StepDots step={2} />
        <div className="flex items-center mb-4">
          <button
            onClick={() => setStep(1)}
            className="w-8 h-8 flex items-center justify-center text-white/50 text-base"
          >
            ←
          </button>
          <p className="flex-1 text-center text-white/40 text-[11px] font-bold uppercase tracking-widest">
            {language === "he" ? "בחר מצב רוח" : "Pick a Mood"}
          </p>
          <div className="w-8" />
        </div>

        {selectedWorld && (
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="text-2xl">{selectedWorld.emoji}</span>
            <span className="text-white/60 text-sm">{selectedWorld.label}</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {MOODS.map((mood) => (
            <button
              key={mood.id}
              onClick={() => {
                setSelectedMood(mood);
                setStep(3);
              }}
              className="flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${mood.accent}33`,
              }}
            >
              <span className="text-3xl">{mood.emoji}</span>
              <div className="flex flex-col flex-1">
                <span className="text-white font-semibold text-sm">{mood.label}</span>
                <span className="text-white/40 text-xs mt-0.5">{mood.desc}</span>
              </div>
              <div
                className="w-2 h-2 rounded-full opacity-60"
                style={{ background: mood.accent }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step 3: Personal Stamp ─────────────────────────────────────────────────
  const canCreate = personalStamp.trim().length > 0;

  return (
    <div className="flex flex-col">
      <StepDots step={3} />
      <div className="flex items-center mb-4">
        <button
          onClick={() => {
            setPersonalStamp("");
            setStep(2);
          }}
          className="w-8 h-8 flex items-center justify-center text-white/50 text-base"
        >
          ←
        </button>
        <p className="flex-1 text-center text-white/40 text-[11px] font-bold uppercase tracking-widest">
          {language === "he" ? "הוסף נגיעה אישית" : "Add Your Stamp"}
        </p>
        <div className="w-8" />
      </div>

      {/* Warm dark card */}
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-4 mb-5"
        style={{
          background: "linear-gradient(160deg,#1a0e08,#2a1a10)",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
      >
        {selectedWorld && (
          <span className="text-5xl">{selectedWorld.emoji}</span>
        )}

        <p className="text-white/80 text-sm text-center leading-relaxed font-medium">
          {selectedWorld?.question}
        </p>

        {/* Microphone button */}
        {hasSpeechSupport && (
          <div className="flex flex-col items-center gap-1">
            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all active:scale-95"
              style={
                isRecording
                  ? {
                      background: "rgba(239,68,68,0.2)",
                      border: "2px solid #EF4444",
                      boxShadow: "0 0 0 6px rgba(239,68,68,0.15)",
                    }
                  : {
                      background: "rgba(245,158,11,0.12)",
                      border: "2px solid rgba(245,158,11,0.35)",
                    }
              }
            >
              {isRecording ? "🔴" : "🎙️"}
            </button>
            <span className="text-white/30 text-[10px]">
              {language === "he" ? "לחץ לדיבור · או הקלד למטה" : "Hold to speak · or type below"}
            </span>
          </div>
        )}

        {/* Text input */}
        <input
          type="text"
          placeholder={language === "he" ? "כתוב את תשובתך…" : "Type your answer…"}
          value={personalStamp}
          onChange={(e) => setPersonalStamp(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none text-center transition-colors"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: personalStamp.trim()
              ? "1px solid rgba(245,158,11,0.6)"
              : "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.6)")}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = personalStamp.trim()
              ? "rgba(245,158,11,0.6)"
              : "rgba(255,255,255,0.1)")
          }
        />
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!canCreate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={
          canCreate && !generating
            ? {
                background: "linear-gradient(90deg,#F59E0B,#D97706)",
                color: "#1a0e08",
                boxShadow: "0 4px 24px rgba(245,158,11,0.35)",
              }
            : {
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.07)",
              }
        }
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse">✨</span>
            {language === "he" ? "יוצר סיפור…" : "Generating story…"}
          </span>
        ) : language === "he" ? (
          "צור סיפור"
        ) : (
          "CREATE MY STORY"
        )}
      </button>
    </div>
  );
}
