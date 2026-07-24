// Central icon registry — edit ONLY this file to swap any icon in the app.
// Every component uses <Icon name="..." /> and never imports a specific library.
//
// Icons are inlined Lucide SVG paths (lucide.dev) — ISC license.
// To swap an icon: replace the JSX below for that name.
// To switch to a library (e.g. lucide-react): replace the factory functions
// with library imports and update the ICONS map.

import React from "react";

type IconProps = { size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties };
type IconComponent = (props: IconProps) => React.ReactElement;

function paths(...ds: string[]): IconComponent {
  return function LucideIcon({ size = 24, strokeWidth = 1.6, className, style }: IconProps) {
    return React.createElement(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className, style },
      ...ds.map((d, i) => React.createElement("path", { key: i, d })),
    );
  };
}

function mixed(...children: React.ReactElement[]): IconComponent {
  return function LucideIcon({ size = 24, strokeWidth = 1.6, className, style }: IconProps) {
    return React.createElement(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className, style },
      ...children.map((c, i) => React.cloneElement(c, { key: i })),
    );
  };
}

const p = (d: string) => React.createElement("path", { d });
const c = (cx: number, cy: number, r: number) => React.createElement("circle", { cx, cy, r });
const rect = (x: number, y: number, width: number, height: number, rx?: number) => React.createElement("rect", { x, y, width, height, ...(rx !== undefined ? { rx } : {}) });
const line = (x1: number, y1: number, x2: number, y2: number) => React.createElement("line", { x1, y1, x2, y2 });

export const ICONS = {
  // ── Bottom nav ───────────────────────────────────────────────────────────────
  navHome: paths(
    "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "M9 22V12h6v10",
  ),
  navProfile: paths(
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ),
  navStories: paths(
    "M12 7v14",
    "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  ),
  navCreate: paths(
    "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",
    "m14 7 3 3", "M5 6v4", "M19 14v4", "M10 2v2", "M7 8H3", "M21 16h-4", "M11 3H9",
  ),
  navVoices: mixed(
    p("M12 19v3"),
    p("M19 10v2a7 7 0 0 1-14 0v-2"),
    rect(9, 2, 6, 13, 3),
  ),
  navMySpace: paths(
    "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
  ),

  // ── Navigation ───────────────────────────────────────────────────────────────
  back: paths("m12 19-7-7 7-7", "M19 12H5"),
  forward: paths("M5 12h14", "m12 5 7 7-7 7"),
  close: paths("M18 6 6 18", "m6 6 12 12"),
  expand: paths("m6 9 6 6 6-6"),
  collapse: paths("m18 15-6-6-6 6"),
  chevronRight: paths("m9 18 6-6-6-6"),

  // ── Actions ──────────────────────────────────────────────────────────────────
  restore: paths("M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"),
  delete: paths("M10 11v6", "M14 11v6", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"),
  edit: paths("M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z", "m15 5 4 4"),
  search: mixed(p("m21 21-4.34-4.34"), c(11, 11, 8)),
  save: paths(
    "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",
    "M7 3v4a1 1 0 0 0 1 1h7",
  ),
  folder: paths("m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"),
  submit: paths("M20 4v7a4 4 0 0 1-4 4H4", "m9 10-5 5 5 5"),
  // Universal three-node "share" glyph — reads clearly as "share" across
  // platforms, unlike the outbox-tray emoji (📤) it replaces, which many
  // people associate with mail/archiving rather than sharing.
  share: mixed(c(18, 5, 3), c(6, 12, 3), c(18, 19, 3), line(8.59, 13.51, 15.42, 17.49), line(15.41, 6.51, 8.59, 10.49)),

  // ── Playback ─────────────────────────────────────────────────────────────────
  play: paths("M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"),
  pause: mixed(rect(14, 3, 5, 18, 1), rect(5, 3, 5, 18, 1)),
  stop: mixed(rect(3, 3, 18, 18, 2)),
  rewind: mixed(
    p("M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"),
    p("M3 20V4"),
  ),

  // ── Media / audio ────────────────────────────────────────────────────────────
  mic: mixed(p("M12 19v3"), p("M19 10v2a7 7 0 0 1-14 0v-2"), rect(9, 2, 6, 13, 3)),
  send: paths(
    "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
    "m21.854 2.147-10.94 10.939",
  ),
  volume: paths(
    "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
    "M16 9a5 5 0 0 1 0 6",
    "M19.364 18.364a9 9 0 0 0 0-12.728",
  ),
  music: mixed(p("M9 18V5l12-2v13"), c(6, 18, 3), c(18, 16, 3)),

  // ── Profile settings ─────────────────────────────────────────────────────────
  bell: paths(
    "M10.268 21a2 2 0 0 0 3.464 0",
    "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
  ),
  moon: paths("M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"),
  sparkles: mixed(
    p("M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"),
    p("M20 2v4"), p("M22 4h-4"), c(4, 20, 2),
  ),
  waveform: paths("M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"),
  activityLine: paths("M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"),

  // ── Devices ──────────────────────────────────────────────────────────────────
  mobile:  mixed(rect(5, 2, 14, 20, 2), p("M12 18h.01")),
  tablet:  mixed(rect(4, 2, 16, 20, 2), line(12, 18, 12.01, 18)),
  desktop: mixed(rect(2, 3, 20, 14, 2), line(8, 21, 16, 21), line(12, 17, 12, 21)),
  auto:    mixed(rect(2, 3, 20, 14, 2), line(8, 21, 16, 21), line(12, 17, 12, 21)),

  // ── Status ───────────────────────────────────────────────────────────────────
  warning: paths("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"),
  success: paths("M21.801 10A10 10 0 1 1 17 3.335", "m9 11 3 3L22 4"),
  error:   mixed(c(12, 12, 10), p("m15 9-6 6"), p("m9 9 6 6")),

  // ── Values (abstract, minimal — no emoji) ────────────────────────────
  shield:    paths("M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"),
  users:     mixed(p("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), c(9, 7, 4), p("M22 21v-2a4 4 0 0 0-3-3.87"), p("M16 3.13a4 4 0 0 1 0 7.75")),
  heart:     paths("M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"),
  star:      paths("M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"),
  trendingUp: mixed(p("M16 7h6v6"), p("m22 7-8.5 8.5-5-5L2 17")),
  gift:      mixed(rect(3, 8, 18, 4, 1), p("M12 8v13"), p("M19 12v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7"), p("M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5")),
  clock:     mixed(c(12, 12, 10), p("M12 6v6l4 2")),
  diversity: mixed(c(5, 12, 2), c(12, 12, 3.5), c(19, 12, 2.5)),
  checklist: mixed(rect(8, 2, 8, 4, 1), p("M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"), p("m9 14 2 2 4-4")),
  sun:       mixed(c(12, 12, 4), line(12, 2, 12, 4), line(12, 20, 12, 22), line(4.93, 4.93, 6.34, 6.34), line(17.66, 17.66, 19.07, 19.07), line(2, 12, 4, 12), line(20, 12, 22, 12), line(6.34, 17.66, 4.93, 19.07), line(19.07, 4.93, 17.66, 6.34)),

  // ── Director's Note quick-mood chips (abstract, minimal — no emoji) ────────
  smile:    mixed(c(12, 12, 10), p("M8 14s1.5 2 4 2 4-2 4-2"), p("M9 9h.01"), p("M15 9h.01")),
  scissors: mixed(c(6, 6, 3), c(6, 18, 3), p("M20 4 8.12 15.88"), p("M14.47 14.48 20 20"), p("M8.12 8.12 12 12")),
  zap:      paths("M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"),

  // ── Story mood chips (abstract, minimal — no emoji) ─────────────────────────
  compass: mixed(c(12, 12, 10), p("M16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88Z")),
  balloon: mixed(
    p("M12 2c3.3 0 6 2.7 6 6 0 3.6-2.7 6.3-5.3 8.6a1 1 0 0 1-1.4 0C8.7 14.3 6 11.6 6 8c0-3.3 2.7-6 6-6Z"),
    p("M12 16.6v1.4"),
    p("M12 18c1.5.9 1.5 2.1 0 3s-1.5 2.1 0 3"),
  ),
  laugh: mixed(c(12, 12, 10), p("M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5Z"), p("M9 9h.01"), p("M15 9h.01")),

  // ── Story Journey value badges (abstract, minimal — no emoji) ──────────────
  flame:           paths("M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"),
  friendshipRings: mixed(c(9, 12, 6), c(15, 12, 6)),
  heartSparkle:    mixed(
    React.createElement("path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z", transform: "translate(-3.5,3) scale(0.62)" }),
    line(18.5, 3, 18.5, 6.5),
    line(16.75, 4.75, 20.25, 4.75),
  ),

  // ── Multi-chapter story indicator (stacked cards, no sound glyph) ──────────
  // Each rect carries an opaque fill (matching the app's dark cosmic
  // background) so the front card actually hides the ones stacked behind it,
  // instead of the previous opacity-only fade that just left them see-through.
  episodes: mixed(
    React.createElement("rect", { x: 8, y: 1.5, width: 14.5, height: 14.5, rx: 3.5, fill: "#0a0d1f" }),
    React.createElement("rect", { x: 5, y: 4.5, width: 14.5, height: 14.5, rx: 3.5, fill: "#0a0d1f" }),
    React.createElement("rect", { x: 2, y: 7.5, width: 14.5, height: 14.5, rx: 3.5, fill: "#0a0d1f" }),
  ),
} as const;

export type IconName = keyof typeof ICONS;
