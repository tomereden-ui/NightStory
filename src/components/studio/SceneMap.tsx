"use client";

import React, { useState } from "react";
import type { StoryScene, ScriptBlock } from "@/types";

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Word-count based per-scene estimate (130 wpm, matching sceneGenerator.ts's
// server-side formula) — this is only ever a rough pacing proxy, since it's
// computed from script text before any audio exists.
function estimateRawDuration(scene: StoryScene, blocks: ScriptBlock[]): number {
  if (scene.estimatedDurationSeconds) return scene.estimatedDurationSeconds;
  if (blocks.length === 0) return 0;
  const { start, end } = scene.lineRange;
  const sb = blocks.slice(Math.max(0, start), Math.min(blocks.length, end + 1))
    .filter((b) => b.characterName !== "SFX");
  const words = sb.reduce((s, b) => s + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.ceil(words / (130 / 60));
}

// The per-scene estimate and the story's real total (measured from the
// actual produced audio file, see produce-drama/route.ts) come from two
// disconnected pipelines and don't naturally agree. When the real total is
// known, scale every scene's estimate proportionally so they sum EXACTLY to
// it — preserves each scene's relative pacing while guaranteeing the numbers
// shown always add up to the real story length, not just approximate it.
function computeSceneDurations(scenes: StoryScene[], blocks: ScriptBlock[], totalDurationSeconds?: number): number[] {
  const raw = scenes.map((scene) => estimateRawDuration(scene, blocks));
  if (!totalDurationSeconds || totalDurationSeconds <= 0) return raw;

  const rawSum = raw.reduce((a, b) => a + b, 0);
  if (rawSum <= 0) return raw;

  const scaled = raw.map((d) => Math.round((d / rawSum) * totalDurationSeconds));
  const drift = totalDurationSeconds - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] = Math.max(0, scaled[scaled.length - 1] + drift);
  return scaled;
}

function charactersInScene(scene: StoryScene, blocks: ScriptBlock[]): string[] {
  const { start, end } = scene.lineRange;
  const sb = blocks.slice(Math.max(0, start), Math.min(blocks.length, end + 1));
  const seen = new Set<string>();
  const names: string[] = [];
  for (const b of sb) {
    if (b.characterName === "SFX" || seen.has(b.characterName)) continue;
    seen.add(b.characterName);
    names.push(b.characterName);
  }
  return names;
}

interface SceneMapProps {
  scenes: StoryScene[];
  blocks: ScriptBlock[];
  onSceneClick?: (blockIndex: number) => void;
  /** Real total story duration (from the produced audio file) — when given,
   * per-scene durations are scaled to sum exactly to it instead of showing
   * raw, unreconciled word-count estimates. */
  totalDurationSeconds?: number;
}

export default function SceneMap({ scenes, blocks, onSceneClick, totalDurationSeconds }: SceneMapProps) {
  const [expanded, setExpanded] = useState(false);

  if (!scenes || scenes.length === 0) return null;

  const durations = computeSceneDurations(scenes, blocks, totalDurationSeconds);

  return (
    <div className="mb-5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left mb-3"
      >
        <span
          className="text-fs-body font-bold uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          Story Scenes
        </span>
        <span className="text-fs-label" style={{ color: "rgba(255,255,255,0.2)" }}>
          ({scenes.length})
        </span>
        <span
          className="ml-auto text-fs-body transition-transform"
          style={{ color: "rgba(255,255,255,0.28)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col">
          {scenes.map((scene, idx) => {
            const duration = durations[idx] ?? 0;
            const characters = charactersInScene(scene, blocks);
            const isLast = idx === scenes.length - 1;

            return (
              <div key={scene.sceneNumber} className="flex gap-3">
                {/* Timeline column */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                  {/* Circle number */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-fs-label font-bold flex-shrink-0"
                    style={{
                      background: "rgba(79,195,247,0.10)",
                      border: "1.5px solid rgba(79,195,247,0.28)",
                      color: "#4fc3f7",
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

                  {/* Who's in this scene — more useful to a reader deciding
                      what to skip to than a one-word mood label was. */}
                  {characters.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {characters.map((name) => (
                        <span
                          key={name}
                          className="text-fs-label font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
