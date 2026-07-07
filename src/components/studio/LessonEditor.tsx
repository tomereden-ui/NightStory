"use client";

import React, { useState, useRef, useEffect } from "react";
import { getLessonsCatalog, getLessonsChrome, LESSON_IDS, type LessonLabel } from "@/constants/lessonsUi";
import Icon from "@/components/ui/Icon";
import type { MoralLesson } from "@/types";

function isPreset(l: string): l is LessonLabel {
  return (LESSON_IDS as readonly string[]).includes(l);
}

export default function LessonEditor({
  lessons,
  onChange,
  onRewrite,
  moralLessons,
  analyzing,
  storyLanguage,
}: {
  lessons: string[];
  onChange: (lessons: string[]) => void;
  onRewrite?: (instruction: string) => void;
  /** Gemini's confirmed analysis of what's actually embedded in the current script — may include values the user never explicitly picked. */
  moralLessons?: MoralLesson[];
  analyzing?: boolean;
  /** The story's actual content language — falls back to English chrome/catalog if not provided. */
  storyLanguage?: string;
}) {
  const LESSONS = getLessonsCatalog(storyLanguage);
  const ui = getLessonsChrome(storyLanguage);
  const [expanded, setExpanded] = useState(false);

  // Editing state (only used when expanded)
  const [pendingLabels, setPendingLabels] = useState<LessonLabel[]>([]);
  const [pendingCustom, setPendingCustom] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Locally-displayed lessons + pending removals — clicking the X just
  // updates what's shown here; nothing is sent to Gemini until the user
  // explicitly clicks "Rewrite story". Resynced whenever a fresh analysis
  // actually lands from the parent (i.e. moralLessons itself changes).
  const [displayedLessons, setDisplayedLessons] = useState<MoralLesson[]>(moralLessons ?? []);
  const [pendingRemoved, setPendingRemoved] = useState<string[]>([]);

  useEffect(() => {
    setDisplayedLessons(moralLessons ?? []);
    setPendingRemoved([]);
  }, [moralLessons]);

  // The picker pre-selects from the CONFIRMED, DB-saved analysis
  // (displayedLessons, mirroring moralLessons) rather than `lessons` (the
  // user's original selection intent at creation time) -- those two can
  // diverge: an intended lesson might not have actually landed in the text,
  // or the script may have organically embedded a value nobody picked.
  // Showing intent instead of what's really there made the picker look
  // "selected" for values the story doesn't actually contain (or vice versa).
  const confirmedNames = displayedLessons.map((ml) => ml.lesson);
  const currentPresets = confirmedNames.filter(isPreset) as LessonLabel[];
  const currentCustom  = confirmedNames.find((l) => !isPreset(l)) ?? "";

  const openEditor = () => {
    setPendingLabels(currentPresets);
    setPendingCustom(currentCustom);
    setExpanded(true);
  };

  const cancelEditor = () => {
    setExpanded(false);
  };

  const applyEditor = () => {
    const next: string[] = [...pendingLabels];
    const trimmed = pendingCustom.trim();
    if (trimmed) next.push(trimmed);
    onChange(next);
    setExpanded(false);
  };

  const togglePendingLabel = (label: LessonLabel) => {
    setPendingLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  // Combines everything the user has queued up — lessons picked to add and
  // lessons marked for removal — into a single instruction, sent only when
  // "Rewrite story" is clicked.
  const buildRewriteInstruction = (): string => {
    const toAdd = lessons.filter((l) => !pendingRemoved.includes(l));
    const toRemove = pendingRemoved.filter((l) => !lessons.includes(l));
    const parts: string[] = [];
    if (toAdd.length) {
      parts.push(`naturally embed ${toAdd.length === 1 ? "this value" : "these values"} through concrete actions the protagonist takes, without stating ${toAdd.length === 1 ? "it" : "them"} explicitly: ${toAdd.join(", ")}`);
    }
    if (toRemove.length) {
      parts.push(`remove any trace of ${toRemove.length === 1 ? "this value" : "these values"} from the story: ${toRemove.join(", ")}`);
    }
    if (!parts.length) return "Review the story once more, keeping everything as it is.";
    return `Rewrite the story to ${parts.join("; and ")}.`;
  };

  // Removing a lesson only updates what's shown locally — it may not even be
  // in the `lessons` selection (it could've been organically present in the
  // script) — the actual story only changes once "Rewrite story" is clicked.
  const removeMoralLesson = (lesson: string) => {
    setDisplayedLessons((prev) => prev.filter((l) => l.lesson !== lesson));
    setPendingRemoved((prev) => (prev.includes(lesson) ? prev : [...prev, lesson]));
    if (lessons.includes(lesson)) onChange(lessons.filter((l) => l !== lesson));
  };

  const hasLessons = lessons.length > 0;
  const hasPendingChanges = hasLessons || pendingRemoved.length > 0;
  const hasDisplayedLessons = displayedLessons.length > 0;

  // ─── Collapsed view — compact chips only ────────────────────────────────

  if (!expanded) {
    return (
      <div
        className="mb-4 rounded-2xl px-4 py-4"
        style={{
          background: "linear-gradient(160deg, rgba(139,92,246,0.09), rgba(79,195,247,0.05))",
          border: "1px solid rgba(139,92,246,0.25)",
          boxShadow: "0 0 28px rgba(139,92,246,0.06)",
        }}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <span className="text-fs-heading font-bold tracking-tight" style={{ color: "#E9D8FD" }}>
              🌟 {ui.panelTitle}
            </span>
            {hasDisplayedLessons && (
              <p className="text-fs-body mt-0.5" style={{ color: "rgba(196,181,253,0.55)" }}>
                {ui.collapsedSubtitle}
              </p>
            )}
          </div>
          <button
            onClick={openEditor}
            className="flex-shrink-0 text-fs-body font-semibold px-2.5 py-1 rounded-lg transition-all active:scale-95"
            style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.3)", color: "#C4B5FD" }}
          >
            {hasLessons ? ui.editButton : ui.addLessonButton}
          </button>
        </div>

        <div className="mt-3">
          {analyzing && (
            <div className="flex items-center gap-2 py-1.5">
              <span className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
                style={{ borderColor: "rgba(139,92,246,0.2)", borderTopColor: "#C4B5FD" }} />
              <span className="text-fs-body" style={{ color: "rgba(196,181,253,0.6)" }}>
                {ui.analyzing}
              </span>
            </div>
          )}

          {!analyzing && hasDisplayedLessons && (
            <button
              onClick={openEditor}
              className="w-full flex flex-wrap gap-1.5 text-left"
              aria-label={ui.currentlyInStory}
            >
              {displayedLessons.map((ml) => {
                const preset = LESSONS.find((l) => l.label === ml.lesson);
                return (
                  <span
                    key={ml.lesson}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-fs-body font-semibold"
                    style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#C4B5FD" }}
                  >
                    <span>{preset?.icon ?? "✨"}</span>
                    <span>{ml.lesson}</span>
                    <span
                      className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold"
                      style={{ background: "#34d399", color: "#05080F", fontSize: "8px" }}
                    >
                      ✓
                    </span>
                  </span>
                );
              })}
            </button>
          )}

          {!analyzing && !hasDisplayedLessons && (
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>
              {hasLessons ? ui.emptyNoConfirmed : ui.emptyNoLessons}
            </p>
          )}
        </div>

        {hasPendingChanges && onRewrite && (
          <button
            onClick={() => onRewrite(buildRewriteInstruction())}
            className="mt-3 w-full py-2 rounded-xl text-fs-body font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.22)", color: "#C4B5FD" }}
          >
            <span>✦</span>
            <span>{hasLessons ? (lessons.length === 1 ? ui.rewriteWithOne : ui.rewriteWithMany) : ui.rewriteGeneric}</span>
          </button>
        )}
      </div>
    );
  }

  // ─── Expanded panel — full details (scrollable) + add/remove ───────────────

  const canApply = pendingLabels.length > 0 || pendingCustom.trim().length > 0;

  return (
    <div
      className="mb-4 rounded-2xl p-4 flex flex-col gap-4"
      style={{ background: "rgba(139,92,246,0.06)", border: "1.5px solid rgba(139,92,246,0.3)", boxShadow: "0 0 24px rgba(139,92,246,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(139,92,246,0.6)" }}>
            🌟 {ui.panelTitle}
          </span>
          <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {ui.expandedSubtitle}
          </p>
        </div>
        <button
          onClick={cancelEditor}
          className="text-white/25"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Scrollable body: current lessons (with remove) + the picker grid */}
      <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: "60vh" }}>
        {hasDisplayedLessons && (
          <div className="flex flex-col gap-2">
            <label className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>
              {ui.currentlyInStory}
            </label>
            {displayedLessons.map((ml) => {
              const preset = LESSONS.find((l) => l.label === ml.lesson);
              return (
                <div
                  key={ml.lesson}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.16)" }}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(139,92,246,0.16)" }}
                  >
                    <span className="text-fs-heading leading-none">{preset?.icon ?? "✨"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-fs-body font-bold" style={{ color: "#E9D8FD" }}>{ml.lesson}</span>
                      <span
                        className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                        style={{ background: "#34d399", color: "#05080F", fontSize: "9px" }}
                        aria-label={ui.confirmedBadge}
                        title={ui.confirmedBadge}
                      >
                        ✓
                      </span>
                    </div>
                    <p className="text-fs-body leading-snug mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {ml.how}
                    </p>
                  </div>
                  <button
                    onClick={() => removeMoralLesson(ml.lesson)}
                    className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity mt-0.5"
                    style={{ color: "#C4B5FD" }}
                    aria-label={`Remove ${ml.lesson}`}
                  >
                    <Icon name="close" size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Lesson grid */}
        <div className="flex flex-col gap-2">
          <label className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>
            {ui.addAValue}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LESSONS.map(({ id, icon, label, desc }) => {
              const isSelected = pendingLabels.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => togglePendingLabel(id)}
                  className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.97]"
                  style={isSelected
                    ? { background: "rgba(79,195,247,0.12)", border: "1.5px solid rgba(79,195,247,0.5)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-fs-subtitle leading-none">{icon}</span>
                    {isSelected && <span className="text-fs-body font-bold" style={{ color: "#4fc3f7" }}>✓</span>}
                  </div>
                  <span className="text-fs-body font-bold leading-tight"
                    style={{ color: isSelected ? "#4fc3f7" : "rgba(255,255,255,0.85)" }}>
                    {label}
                  </span>
                  <span className="text-fs-body leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom text */}
        <div
          className="rounded-xl px-3.5 py-3 transition-all"
          style={pendingCustom.trim()
            ? { background: "rgba(79,195,247,0.07)", border: "1.5px solid rgba(79,195,247,0.35)" }
            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }
          }
        >
          <label className="text-fs-body font-bold uppercase tracking-widest block mb-1.5" style={{ color: "rgba(79,195,247,0.5)" }}>
            {ui.orDescribeOwn}
          </label>
          <textarea
            ref={inputRef}
            value={pendingCustom}
            onChange={(e) => setPendingCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canApply) {
                e.preventDefault();
                applyEditor();
              }
            }}
            rows={2}
            placeholder={ui.customPlaceholder}
            className="w-full bg-transparent outline-none resize-none text-fs-body leading-relaxed placeholder-white/20 text-white/80"
            style={{ caretColor: "#4fc3f7" }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={cancelEditor}
          className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
        >
          {ui.cancel}
        </button>
        {canApply && (
          <button
            onClick={applyEditor}
            className="flex-1 py-2.5 rounded-xl text-fs-body font-semibold transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.3), rgba(79,195,247,0.25))", border: "1.5px solid rgba(139,92,246,0.4)", color: "#C4B5FD" }}
          >
            {`${ui.apply}${pendingLabels.length > 0 ? ` (${pendingLabels.length + (pendingCustom.trim() ? 1 : 0)})` : ""}`}
          </button>
        )}
      </div>

      {/* Clear all */}
      {hasLessons && (
        <button
          onClick={() => { onChange([]); setExpanded(false); }}
          className="text-center text-fs-body font-medium transition-opacity"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          {ui.removeAll}
        </button>
      )}
    </div>
  );
}
