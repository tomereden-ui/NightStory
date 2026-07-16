"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. High-fidelity hardcover per the design spec:
//   1. Perspective + angle: perspective 1200px on the container, the book
//      leans rotateY(-4deg); on hover it lifts and straightens (the .book-3d
//      class in globals.css — inline styles can't express :hover).
//   2. Spine: a multi-stop gradient overlay on the cover's left edge
//      simulates the rounded spine ridge and the adjacent hinge crease.
//   3. Pages: a warm paper block (#f4f3ef with a high-density 1px line
//      texture that reads as hundreds of finely stacked pages) peeks out on
//      the right AND slightly at the bottom, aligned with the 3D angle.
//   4. Rim + shadows: an inset rim light catches the cardboard cover's
//      physical edge, and the pages block carries a three-layer ambient-
//      occlusion shadow stack (anchor / mid-soft / ambient blur) that seats
//      the book on the dark background.
// The pages' left edge stays well inside the cover (10%) so paper can't
// peek through the notches left by the cover's rounded left corners.
// Percentages keep every dimension proportional to the card size.
//
// Layout guidance for callers (spec point 5): keep the artwork clean —
// titles, chapter info, and progress live BELOW the book in normal flow,
// not overlaid on the cover. The `overlay` prop remains for the few things
// that belong physically ON the jacket (small badge chips, the creator-
// avatar "seal"); it renders inside the front-cover box so it can never
// drift out of alignment with the tilted image.
export default function BookCover({
  coverUrl,
  alt,
  borderRadius = 6,
  showShadow = true,
  className,
  onImgError,
  overlay,
}: {
  coverUrl: string;
  alt: string;
  /** Outer-corner radius of the cover; the spine-side corners are kept
   *  tighter (a hardcover hinges at its spine). */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Chrome that belongs physically ON the jacket (badge chips, avatar
   *  seal). Rendered inside the front-cover box so it stays pixel-aligned
   *  with the tilted image. Titles/metadata belong below the book instead. */
  overlay?: ReactNode;
}) {
  const spineRadius = Math.max(2, borderRadius - 3);
  const pageRadius = Math.max(2, borderRadius - 2);

  return (
    // .book-container — establishes the 3D perspective
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      {/* .book — leans rotateY(-4deg); lifts/straightens on hover (globals.css) */}
      <div className="book-3d relative w-full h-full">
        {/* .book-pages — warm stacked-paper block peeking out on the right
            and slightly at the bottom */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "91%",
            height: "99%",
            top: "1%",
            left: "8%",
            zIndex: 1,
            background: "#f4f3ef",
            backgroundImage:
              "repeating-linear-gradient(to right, #f4f3ef 0px, #f4f3ef 1px, #e3dfd5 1.5px, #e3dfd5 2px)",
            borderRadius: `0 ${pageRadius}px ${pageRadius}px 0`,
            boxShadow: showShadow
              ? "3px 2px 5px rgba(0,0,0,0.5), 8px 8px 16px rgba(0,0,0,0.35), 12px 16px 28px rgba(0,0,0,0.2)"
              : undefined,
          }}
        />
        {/* .book-cover — the hardcover front board; narrower and a touch
            shorter than the pages so they peek right + bottom */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "96%",
            height: "98%",
            zIndex: 2,
            borderRadius: `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`,
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.15), 2px 2px 6px rgba(0,0,0,0.45)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
          {/* .spine-crease — rounded spine ridge highlight + hinge crease */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.15) 1.5%, rgba(0,0,0,0.08) 3%, rgba(0,0,0,0.25) 4.5%, rgba(0,0,0,0) 7%)",
            }}
          />
          {overlay}
        </div>
      </div>
    </div>
  );
}
