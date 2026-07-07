"use client";

import { getLessonsCatalog, getLessonsChrome } from "@/constants/lessonsUi";
import type { MoralLesson } from "@/types";

export default function ReadOnlyLessonsPanel({
  moralLessons,
  storyLanguage,
}: {
  moralLessons?: MoralLesson[];
  /** The story's actual content language — falls back to English chrome/catalog if not provided. */
  storyLanguage?: string;
}) {
  if (!moralLessons?.length) return null;

  const LESSONS = getLessonsCatalog(storyLanguage);
  const ui = getLessonsChrome(storyLanguage);

  return (
    <div
      className="mb-4 rounded-2xl px-4 py-4"
      style={{
        background: "linear-gradient(160deg, rgba(139,92,246,0.09), rgba(79,195,247,0.05))",
        border: "1px solid rgba(139,92,246,0.25)",
        boxShadow: "0 0 28px rgba(139,92,246,0.06)",
      }}
    >
      <div className="mb-1">
        <span className="text-fs-heading font-bold tracking-tight" style={{ color: "#E9D8FD" }}>
          🌟 {ui.panelTitle}
        </span>
        <p className="text-fs-body mt-0.5" style={{ color: "rgba(196,181,253,0.55)" }}>
          {ui.collapsedSubtitle}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label={ui.currentlyInStory}>
        {moralLessons.map((ml) => {
          const preset = LESSONS.find((l) => l.label === ml.lesson);
          return (
            <span
              key={ml.lesson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-fs-body font-semibold"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#C4B5FD" }}
            >
              <span>{preset?.icon ?? "✨"}</span>
              <span>{ml.lesson}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
