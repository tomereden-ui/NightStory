"use client";

import React, { useState, useRef } from "react";

const LESSONS = [
  { icon: "🦁", label: "Bravery",               desc: "Facing fears, trying scary things" },
  { icon: "🤝", label: "Friendship",             desc: "Sharing, including others, resolving conflict" },
  { icon: "💝", label: "Kindness",               desc: "Noticing when others need help" },
  { icon: "⭐", label: "Honesty",                desc: "Telling the truth even when it's hard" },
  { icon: "🌱", label: "Perseverance",           desc: "Trying again after failing" },
  { icon: "🎁", label: "Sharing",                desc: "Generosity with others" },
  { icon: "⏳", label: "Patience",               desc: "Waiting calmly" },
  { icon: "🌈", label: "Respecting differences", desc: "Appreciating diversity, not judging" },
  { icon: "🌟", label: "Responsibility",         desc: "Taking care of things, pets, promises" },
  { icon: "🙏", label: "Gratitude",              desc: "Appreciating what you have" },
] as const;

type LessonLabel = typeof LESSONS[number]["label"];

export default function LessonStep({
  onSelect,
  onBack,
}: {
  onSelect: (lesson: string | null) => void;
  onBack?: () => void;
}) {
  const [selected, setSelected] = useState<LessonLabel | null>(null);
  const [custom, setCustom] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleCardTap = (label: LessonLabel) => {
    if (custom.trim()) return; // custom text takes priority — don't auto-advance
    setSelected(label);
    onSelect(label);
  };

  const handleCustomContinue = () => {
    const val = custom.trim();
    if (!val) return;
    onSelect(val);
  };

  const selectedStyle = {
    background: "rgba(79,195,247,0.12)",
    border: "1.5px solid rgba(79,195,247,0.5)",
    boxShadow: "0 0 16px rgba(79,195,247,0.12)",
  };

  const defaultCardStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
  };

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-4 text-xs font-medium transition-opacity active:opacity-60"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <span>←</span>
            <span>Back to idea</span>
          </button>
        )}
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(79,195,247,0.05) 100%)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: "rgba(139,92,246,0.7)" }}>
            Optional · Step 2
          </p>
          <h2 className="text-base font-bold text-white leading-snug mb-1">
            Want today&apos;s story to teach something?
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            Pick a value and it will be woven into the story naturally — not stated out loud.
          </p>
        </div>
      </div>

      {/* Lesson grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {LESSONS.map(({ icon, label, desc }) => {
          const isSelected = selected === label && !custom.trim();
          return (
            <button
              key={label}
              onClick={() => handleCardTap(label)}
              className="flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.97]"
              style={isSelected ? selectedStyle : defaultCardStyle}
            >
              <span className="text-2xl leading-none">{icon}</span>
              <span
                className="text-xs font-bold leading-tight"
                style={{ color: isSelected ? "#4fc3f7" : "rgba(255,255,255,0.85)" }}
              >
                {label}
              </span>
              <span className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.38)" }}>
                {desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom lesson input — card-shaped */}
      <div
        className="rounded-2xl px-4 py-3.5 transition-all"
        style={custom.trim()
          ? { background: "rgba(79,195,247,0.07)", border: "1.5px solid rgba(79,195,247,0.35)", boxShadow: "0 0 12px rgba(79,195,247,0.08)" }
          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }
        }
      >
        <label className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: "rgba(79,195,247,0.5)" }}>
          Or describe your own
        </label>
        <textarea
          ref={inputRef}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && custom.trim()) { e.preventDefault(); handleCustomContinue(); } }}
          rows={2}
          placeholder="Or describe your own lesson…"
          className="w-full bg-transparent outline-none resize-none text-sm leading-relaxed placeholder-white/20 text-white/80"
          style={{ caretColor: "#4fc3f7" }}
        />
        {custom.trim() && (
          <button
            onClick={handleCustomContinue}
            className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)", color: "#fff", boxShadow: "0 4px 20px rgba(79,195,247,0.2)" }}
          >
            <span>✨</span>
            <span>Write My Story</span>
          </button>
        )}
      </div>

      {/* Skip option — equal visual weight to lesson cards */}
      <button
        onClick={() => onSelect(null)}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1.5px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <span className="text-lg">🌙</span>
        <span>Skip — just tell a fun story</span>
      </button>

    </div>
  );
}
