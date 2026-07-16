"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Based on the reference CSS the user supplied
// (.book-container / .book / .book-pages / .book-cover / .spine-crease),
// extended to match the approved grid screenshot, which reads "thicker,
// more physical" because of three extra cues:
//   1. a dark back-cover board behind everything, peeking past the pages
//      on the right — the outermost edge of the book;
//   2. a thicker cream page block between that board and the front cover;
//   3. visible thickness along the TOP edge — the front cover sits slightly
//      below the top of the book block, so a strip of dark board shows
//      above the art (as if viewing the book from a touch above).
// The bottom edge stays flush — earlier rounds proved a bottom sliver
// reads as a distracting stripe, so all depth cues live on the right and
// top only. Percentages keep every dimension proportional to the card size.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. Any title/gradient/badge chrome that needs to sit ON
// the cover must go through the `overlay` prop (rendered inside the same
// box as the front-cover image) rather than a separate sibling, so it can
// never drift out of alignment with the displayed cover.
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
   *  slightly tighter, as in the reference (4px spine / 6px page edge). */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Title/gradient/badge chrome rendered on top of the image, inside the
   *  same front-cover box so it can never drift out of alignment with the
   *  displayed cover. */
  overlay?: ReactNode;
}) {
  const spineRadius = Math.max(2, borderRadius - 2);

  return (
    // .book-container — establishes the subtle 3D environment
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      {/* .book — wrapper handling the slight turn */}
      <div
        className="relative w-full h-full transition-transform duration-300 ease-out"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(-4deg)" }}
      >
        {/* back-cover board — the outermost dark edge of the book, visible
            past the pages on the right and as a thin strip of thickness
            along the top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            background: "linear-gradient(115deg, #2a2018 0%, #3a2d20 55%, #1c150e 100%)",
            borderRadius: `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`,
            boxShadow: showShadow
              ? "3px 2px 5px rgba(0,0,0,0.5), 8px 8px 16px rgba(0,0,0,0.35), 12px 16px 28px rgba(0,0,0,0.2)"
              : undefined,
          }}
        />
        {/* .book-pages — the physical paper edge revealed on the right,
            between the front cover and the back board. Left edge stays well
            behind the cover so paper can't peek through the cover's rounded
            left-corner notches. */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "88%",
            height: "95%",
            top: "2.5%",
            left: "10%",
            zIndex: 1,
            background: "#f4f3ef",
            backgroundImage:
              "repeating-linear-gradient(to right, #f4f3ef 0px, #f4f3ef 1px, #e3dfd5 2px, #e3dfd5 3px)",
            borderRadius: `0 ${spineRadius}px ${spineRadius}px 0`,
            boxShadow: "1px 1px 3px rgba(0,0,0,0.35)",
          }}
        />
        {/* .book-cover — the front cover hardback: narrower than the book so
            the pages + board show on the right, and dropped slightly below
            the top so the board's thickness shows above the art */}
        <div
          className="absolute left-0 overflow-hidden"
          style={{
            width: "94.5%",
            height: "97.5%",
            top: "2.5%",
            zIndex: 2,
            borderRadius: `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`,
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.15), 2px 0px 5px rgba(0,0,0,0.4)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
          {/* .spine-crease — rounded spine-edge highlight and the adjacent
              deep crease, crucial for the "real book" illusion */}
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
