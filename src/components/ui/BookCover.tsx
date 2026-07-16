"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Geometry per the design spec:
//   - The container carries perspective: 1500px AND transform-style:
//     preserve-3d so the child rotation renders with true depth instead of
//     being flattened by the parent rendering context.
//   - The book leans rotateY(-8deg) rotateX(1.5deg) (.book-3d in
//     globals.css, which also holds the hover lift — inline styles can't
//     express :hover).
//   - The cover is the baseline front face: 96% wide / 97% tall, leaving
//     room on the right and bottom for the page edges. Crisp book corners
//     (4px spine side / 2px page side).
//   - The page block spans the full width behind the cover, but its left
//     edge sits a fixed 4px in from the container (not a percentage) —
//     just enough to hide completely behind the cover's left edge at any
//     card size, without shrinking the block enough to read as a hollow
//     flap. Square left corners (border-radius: 0 4px 4px 0) mean nothing
//     can peek through the cover's rounded left corners either.
//   - Fine stacked-page texture runs in both directions (vertical lines
//     for the right edge, horizontal for the bottom) as subtle dark
//     overlays on the warm paper base, plus a three-layer ambient-
//     occlusion shadow stack (tight contact / soft spread / far ambient).
//
// Layout guidance for callers: keep the artwork clean — titles, chapter
// info, and progress live BELOW the book in normal flow. The `overlay`
// prop is only for things that belong physically ON the jacket (small
// badge chips, the creator-avatar "seal").
export default function BookCover({
  coverUrl,
  alt,
  showShadow = true,
  className,
  onImgError,
  overlay,
}: {
  coverUrl: string;
  alt: string;
  /** Retained for call-site compatibility; corner radii are now fixed
   *  crisp book corners (4px spine / 2px page edge) per the design spec. */
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
  return (
    // .book-container — explicit depth + preserve-3d so the rotation isn't flattened
    <div
      className={`relative w-full h-full ${className ?? ""}`}
      style={{ perspective: 1500, transformStyle: "preserve-3d" }}
    >
      {/* .book — rotateY(-8deg) rotateX(1.5deg); hover lift via globals.css */}
      <div className="book-3d relative w-full h-full">
        {/* .book-pages — solid continuous block behind the cover. Left edge
            sits just 4px in from the container (fixed px, not a percentage)
            so it hides completely behind the cover's left edge at any card
            size, while still peeking out on the right and bottom. */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "calc(100% - 4px)",
            height: "97.5%",
            top: "1%",
            left: "4px",
            zIndex: 1,
            backgroundColor: "#f4f2eb",
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0px, transparent 1px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)," +
              "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)",
            borderRadius: "0 4px 4px 0",
            boxShadow: showShadow
              ? "3px 3px 6px rgba(0,0,0,0.55), 10px 12px 24px rgba(0,0,0,0.4), 15px 22px 35px rgba(0,0,0,0.25)"
              : undefined,
          }}
        />
        {/* .book-cover — the full front face of the book; leaves room on
            the right and bottom for the page block to peek out */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "96%",
            height: "97%",
            zIndex: 2,
            borderRadius: "4px 2px 2px 4px",
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.15), 2px 2px 5px rgba(0,0,0,0.3)",
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
