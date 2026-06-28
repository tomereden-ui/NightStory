"use client";

import React, { useState, useRef } from "react";
import Icon from "@/components/ui/Icon";

export const LESSONS = [
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

export type LessonLabel = typeof LESSONS[number]["label"];

export default function LessonStep({
  onSelect,
  onBack,
}: {
  onSelect: (lessons: string[]) => void;
  onBack?: () => void;
}) {
  const [selected, setSelected] = useState<LessonLabel[]>([]);
  const [custom, setCustom] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleLabel = (label: LessonLabel) => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const buildLessons = (): string[] => {
    const result: string[] = [...selected];
    const customTrimmed = custom.trim();
    if (customTrimmed) result.push(customTrimmed);
    return result;
  };

  const canConfirm = selected.length > 0 || custom.trim().length > 0;

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
            className="flex items-center gap-1.5 mb-4 text-fs-label font-medium transition-opacity active:opacity-60"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <Icon name="back" size={14} />
            <span>Back to idea</span>
          </button>
        )}
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(79,195,247,0.05) 100%)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <p className="text-fs-caption font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: "rgba(139,92,246,0.7)" }}>
            Optional · Step 2
          </p>
          <h2 className="text-fs-heading font-bold text-white leading-snug mb-1">
            Want today&apos;s story to teach something?
          </h2>
          <p className="text-fs-label leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            Pick one or more values — they&apos;ll be woven in naturally, never stated out loud.
          </p>
        </div>
      </div>

      {/* Lesson grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {LESSONS.map(({ icon, label, desc }) => {
          const isSelected = selected.includes(label);
          return (
            <button
              key={label}
              onClick={() => toggleLabel(label)}
              className="flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.97]"
              style={isSelected ? selectedStyle : defaultCardStyle}
            >
              <div className="flex items-center justify-between">
                <span className="text-fs-title leading-none">{icon}</span>
                {isSelected && (
                  <span className="text-fs-caption font-bold" style={{ color: "#4fc3f7" }}>✓</span>
                )}
              </div>
              <span
                className="text-fs-label font-bold leading-tight"
                style={{ color: isSelected ? "#4fc3f7" : "rgba(255,255,255,0.85)" }}
              >
                {label}
              </span>
              <span className="text-fs-caption leading-snug" style={{ color: "rgba(255,255,255,0.38)" }}>
                {desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom lesson input */}
      <div
        className="rounded-2xl px-4 py-3.5 transition-all"
        style={custom.trim()
          ? { background: "rgba(79,195,247,0.07)", border: "1.5px solid rgba(79,195,247,0.35)", boxShadow: "0 0 12px rgba(79,195,247,0.08)" }
          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }
        }
      >
        <label className="text-fs-caption font-bold uppercase tracking-widest block mb-2" style={{ color: "rgba(79,195,247,0.5)" }}>
          Or describe your own
        </label>
        <textarea
          ref={inputRef}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canConfirm) {
              e.preventDefault();
              onSelect(buildLessons());
            }
          }}
          rows={2}
          placeholder="e.g. learning to ask for help…"
          className="w-full bg-transparent outline-none resize-none text-fs-body leading-relaxed placeholder-white/20 text-white/80"
          style={{ caretColor: "#4fc3f7" }}
        />
      </div>

      {/* Confirm button — shown when anything is selected */}
      {canConfirm && (
        <button
          onClick={() => onSelect(buildLessons())}
          className="w-full py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)", color: "#fff", boxShadow: "0 4px 28px rgba(79,195,247,0.25), 0 2px 8px rgba(139,92,246,0.25)" }}
        >
          <span>✨</span>
          <span>Write My Story{selected.length > 1 ? ` with ${selected.length} lessons` : ""}</span>
        </button>
      )}

      {/* Skip option */}
      <button
        onClick={() => onSelect([])}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1.5px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <span className="text-fs-heading">🌙</span>
        <span>Skip — just tell a fun story</span>
      </button>

    </div>
  );
}
