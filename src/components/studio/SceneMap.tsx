"use client";

import React from "react";
import type { StoryScene, ScriptBlock } from "@/types";

const MOOD_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Gentle:    { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.28)", text: "#a78bfa" },
  Whimsical: { bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.28)",  text: "#fbbf24" },
  Playful:   { bg: "rgba(79,195,247,0.10)",  border: "rgba(79,195,247,0.28)",  text: "#4fc3f7" },
  Tense:     { bg: "rgba(239,68,68,0.09)",   border: "rgba(239,68,68,0.25)",   text: "#fca5a5" },
  Soothing:  { bg: "rgba(52,211,153,0.09)",  border: "rgba(52,211,153,0.22)",  text: "#34d399" },
  Wondrous:  { bg: "rgba(249,115,22,0.09)",  border: "rgba(249,115,22,0.22)",  text: "#fb923c" },
  Cozy:      { bg: "rgba(245,158,11,0.09)",  border: "rgba(245,158,11,0.22)",  text: "#f59e0b" },
};

const DEFAULT_MOOD = { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.28)", text: "#a78bfa" };

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface SceneMapProps {
  scenes: StoryScene[];
  blocks: ScriptBlock[];
  onSceneClick?: (blockIndex: number) => void;
}

export default function SceneMap({ scenes, blocks, onSceneClick }: SceneMapProps) {
  if (!scenes || scenes.length === 0) return null;

  return (
    <div className="mb-5">
      <p
        className="text-fs-body font-bold uppercase tracking-widest mb-3"
        style={{ color: "rgba(255,255,255,0.28)" }}
      >
        Story Scenes
      </p>

      <div className="flex flex-col">
        {scenes.map((scene, idx) => {
          const mood = MOOD_COLORS[scene.primaryMood] ?? DEFAULT_MOOD;

          // Compute duration client-side if not pre-computed from server
          let duration = scene.estimatedDurationSeconds ?? 0;
          if (!duration && blocks.length > 0) {
            const { start, end } = scene.lineRange;
            const sb = blocks.slice(Math.max(0, start), Math.min(blocks.length, end + 1))
              .filter((b) => b.characterName !== "SFX");
            const words = sb.reduce(
              (s, b) => s + b.textPayload.trim().split(/\s+/).filter(Boolean).length,
              0,
            );
            duration = Math.ceil(words / (130 / 60));
          }

          const isLast = idx === scenes.length - 1;

          return (
            <div key={scene.sceneNumber} className="flex gap-3">
              {/* Timeline column */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                {/* Circle number */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-fs-label font-bold flex-shrink-0"
                  style={{
                    background: mood.bg,
                    border: `1.5px solid ${mood.border}`,
                    color: mood.text,
                  }}
                >
                  {scene.sceneNumber}
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className="w-px flex-1 mt-1 mb-0"
                    style={{ background: "rgba(255,255,255,0.07)", minHeight: 12 }}
                  />
                )}
              </div>

              {/* Scene card */}
              <button
                onClick={() => onSceneClick?.(scene.lineRange.start)}
                className="flex-1 text-left rounded-2xl p-3 transition-all active:scale-[0.98] hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  marginBottom: isLast ? 0 : 8,
                }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p
                    className="text-fs-body font-semibold leading-snug"
                    style={{ color: "rgba(255,255,255,0.82)" }}
                  >
                    Scene {scene.sceneNumber}: {scene.title}
                  </p>
                  {duration > 0 && (
                    <span
                      className="flex-shrink-0 text-fs-label font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(255,255,255,0.32)",
                      }}
                    >
                      {fmtDuration(duration)}
                    </span>
                  )}
                </div>

                {/* One-sentence summary */}
                <p
                  className="text-fs-body leading-relaxed mb-2"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {scene.summary}
                </p>

                {/* Mood chip */}
                <span
                  className="text-fs-label font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: mood.bg, border: `1px solid ${mood.border}`, color: mood.text }}
                >
                  {scene.primaryMood}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
