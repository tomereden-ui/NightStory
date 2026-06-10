"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type VoiceStatus = "cloned" | "demo" | "none";

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  emoji: string;
  status: VoiceStatus;
  accent: string;
  samplePhrase: string;
}

const FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: "fm1", name: "Maya", role: "Child", emoji: "🧒",
    status: "demo", accent: "#00D4FF",
    samplePhrase: "Once upon a time, in a land far away, a little star fell from the sky and became my best friend.",
  },
  {
    id: "fm2", name: "David", role: "Dad", emoji: "👨",
    status: "demo", accent: "#8B5CF6",
    samplePhrase: "The forest was quiet that night, except for the soft crackling of the fire and the whisper of the wind.",
  },
  {
    id: "fm3", name: "Sarah", role: "Mom", emoji: "👩",
    status: "cloned", accent: "#EC4899",
    samplePhrase: "Close your eyes and imagine a sky full of golden clouds, each one holding a dream just for you.",
  },
  {
    id: "fm4", name: "Grandpa", role: "Grandpa", emoji: "👴",
    status: "none", accent: "#F59E0B",
    samplePhrase: "Long ago, before the mountains had names, a brave little dragon decided to climb the tallest peak.",
  },
  {
    id: "fm5", name: "Noa", role: "Friend", emoji: "🧑",
    status: "none", accent: "#10D9A0",
    samplePhrase: "The magical garden only bloomed at midnight, and only children who believed in magic could find it.",
  },
];

const STATUS_LABEL: Record<VoiceStatus, string> = {
  cloned: "Voice Cloned ✓",
  demo:   "Demo Voice",
  none:   "No Voice Yet",
};

const STATUS_COLOR: Record<VoiceStatus, string> = {
  cloned: "#10D9A0",
  demo:   "#00D4FF",
  none:   "rgba(255,255,255,0.25)",
};

// ─── Recording modal ──────────────────────────────────────────────────────────

type RecordingStep = "idle" | "recording" | "processing" | "done";

function RecordingModal({
  member,
  onClose,
  onCloned,
}: {
  member: FamilyMember;
  onClose: () => void;
  onCloned: (id: string) => void;
}) {
  const [step, setStep] = useState<RecordingStep>("idle");
  const [seconds, setSeconds] = useState(0);

  const handleRecord = () => {
    setStep("recording");
    setSeconds(0);
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s >= 5) {
          clearInterval(timer);
          setStep("processing");
          setTimeout(() => {
            setStep("done");
            onCloned(member.id);
          }, 2000);
          return s;
        }
        return s + 1;
      });
    }, 1000);
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9998 }}
        onClick={step === "idle" || step === "done" ? onClose : undefined}
      />
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md rounded-t-3xl overflow-hidden"
        style={{ background: "#111520", border: "1px solid rgba(255,255,255,0.1)", zIndex: 9999 }}
      >
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg,${member.accent},#8B5CF6)` }} />

        <div className="px-6 pt-5 pb-8 flex flex-col items-center gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: "rgba(255,255,255,0.06)", border: `2px solid ${member.accent}40` }}
          >
            {member.emoji}
          </div>

          {step === "done" ? (
            <>
              <div className="text-center">
                <p className="text-white font-bold text-lg mb-1">Voice Cloned!</p>
                <p className="text-white/40 text-sm">{member.name}&apos;s voice has been saved.</p>
              </div>
              <div className="text-4xl animate-bounce">✅</div>
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm"
                style={{ background: `linear-gradient(90deg,${member.accent},#00A8C8)`, color: "#0A0C14" }}
              >
                Done
              </button>
            </>
          ) : step === "processing" ? (
            <>
              <div className="text-center">
                <p className="text-white font-bold text-lg mb-1">Processing…</p>
                <p className="text-white/40 text-sm">Creating voice clone for {member.name}</p>
              </div>
              <div className="flex gap-2 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: member.accent,
                      animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </>
          ) : step === "recording" ? (
            <>
              <div className="text-center">
                <p className="text-white font-bold text-base mb-1">Recording… {seconds}s / 5s</p>
                <p className="text-white/40 text-xs">Keep reading the phrase below</p>
              </div>
              <p
                className="text-sm leading-relaxed text-center px-2 rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                &ldquo;{member.samplePhrase}&rdquo;
              </p>
              {/* Waveform animation */}
              <div className="flex items-center gap-1 h-10">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full flex-shrink-0"
                    style={{
                      background: member.accent,
                      height: `${10 + Math.random() * 28}px`,
                      animation: `bounce 0.4s ease-in-out ${(i % 5) * 0.08}s infinite`,
                      opacity: 0.6 + Math.random() * 0.4,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-white font-bold text-base mb-1">
                  {member.status === "cloned" ? "Re-record" : "Record"} {member.name}&apos;s Voice
                </p>
                <p className="text-white/35 text-xs">Read the phrase below clearly for ~5 seconds</p>
              </div>
              <p
                className="text-sm leading-relaxed text-center px-2 rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                &ldquo;{member.samplePhrase}&rdquo;
              </p>
              <button
                onClick={handleRecord}
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl active:scale-95 transition-transform"
                style={{
                  background: `linear-gradient(135deg,${member.accent},#0088AA)`,
                  boxShadow: `0 4px 24px ${member.accent}44`,
                }}
              >
                🎤
              </button>
              <button onClick={onClose} className="text-white/30 text-sm">Cancel</button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Voices page ──────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const [members, setMembers] = useState<FamilyMember[]>(FAMILY_MEMBERS);
  const [recording, setRecording] = useState<FamilyMember | null>(null);

  const handleCloned = (id: string) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, status: "cloned" } : m));
  };

  const handleAddMember = () => {
    const names = ["Alex", "Lily", "Tom", "Emma", "Jake"];
    const roles = ["Sibling", "Cousin", "Friend", "Uncle", "Aunt"];
    const emojis = ["🧒", "👧", "👦", "🧑", "👩"];
    const accents = ["#00D4FF", "#8B5CF6", "#EC4899", "#F59E0B", "#10D9A0"];
    const i = members.length % 5;
    setMembers((prev) => [
      ...prev,
      {
        id: `fm${Date.now()}`,
        name: names[i],
        role: roles[i],
        emoji: emojis[i],
        status: "none",
        accent: accents[i],
        samplePhrase: "The stars above shone like tiny candles, lighting the way for all the dreamers below.",
      },
    ]);
  };

  return (
    <div className="min-h-full" style={{ background: "#0A0C14" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-base font-semibold text-white tracking-wide mb-0.5">Family Voices</h1>
        <p className="text-white/30 text-xs">Clone real voices to narrate bedtime stories</p>
      </div>

      {/* Stats row */}
      <div className="px-5 mb-5">
        <div
          className="flex items-center justify-around py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {[
            { value: members.filter((m) => m.status === "cloned").length, label: "Cloned", color: "#10D9A0" },
            { value: members.filter((m) => m.status === "demo").length,   label: "Demo",   color: "#00D4FF" },
            { value: members.filter((m) => m.status === "none").length,   label: "Pending", color: "rgba(255,255,255,0.3)" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-bold text-lg leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-white/30 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Member list */}
      <div className="px-5 flex flex-col gap-3 pb-6">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-4 px-4 py-3.5 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `2px solid ${member.status === "cloned" ? member.accent : "rgba(255,255,255,0.1)"}`,
                boxShadow: member.status === "cloned" ? `0 0 12px ${member.accent}30` : "none",
              }}
            >
              {member.emoji}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{member.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/25 text-[10px]">{member.role}</span>
                <span className="text-[10px]" style={{ color: STATUS_COLOR[member.status] }}>
                  · {STATUS_LABEL[member.status]}
                </span>
              </div>
            </div>

            {/* Preview button */}
            {member.status !== "none" && (
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                onClick={() => {
                  const u = new SpeechSynthesisUtterance(member.samplePhrase.slice(0, 60));
                  u.rate = 0.9;
                  window.speechSynthesis.cancel();
                  setTimeout(() => window.speechSynthesis.speak(u), 100);
                }}
              >
                ▶
              </button>
            )}

            {/* Record button */}
            <button
              onClick={() => setRecording(member)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold flex-shrink-0 active:scale-95 transition-transform"
              style={member.status === "cloned" ? {
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
              } : {
                background: `linear-gradient(90deg,${member.accent},#0088AA)`,
                color: "#0A0C14",
              }}
            >
              🎤 {member.status === "cloned" ? "Re-record" : "Record"}
            </button>
          </div>
        ))}

        {/* Add member */}
        <button
          onClick={handleAddMember}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
          style={{ border: "1.5px dashed rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.3)" }}
        >
          + Add Family Member
        </button>
      </div>

      {/* Recording modal */}
      {recording && (
        <RecordingModal
          member={recording}
          onClose={() => setRecording(null)}
          onCloned={(id) => { handleCloned(id); }}
        />
      )}
    </div>
  );
}
