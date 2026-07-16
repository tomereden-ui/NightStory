"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. A single image layer, uniformly rounded, with a
// spine-crease gradient (a highlight next to a shadow, right where a
// hardcover's hinge would be) painted directly onto it, a slight whole-
// group tilt, and a drop shadow. No separate "pages" panel — that was
// tried across a few rounds (peeking on the right, then right+bottom) and
// kept reading as a distracting border/stripe rather than a subtle paper
// hint; the reference this is matched against doesn't show any visible
// page edge at all, just the spine hint and a slight lean. Percentages
// mean every dimension is already proportional to this component's own
// size. Rotation is anchored at the left edge (transformOrigin
// "left center") — a book hinges at its spine, not its center.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. Any title/gradient/badge chrome that needs to sit ON
// the cover must go through the `overlay` prop (rendered inside the same
// box as the image) rather than a separate sibling — since the cover
// itself is now near-full-bleed this matters less than it used to, but
// keeps the tilt group as the single source of truth for the image's
// actual on-screen bounds.
export default function BookCover({
  coverUrl,
  alt,
  borderRadius = 8,
  showShadow = true,
  className,
  onImgError,
  overlay,
}: {
  coverUrl: string;
  alt: string;
  /** Matches whatever rounding the surface used on its old flat <img>. */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Title/gradient/badge chrome rendered on top of the image, inside the
   *  same tilted front-cover box so it can never drift out of alignment
   *  with the displayed cover. */
  overlay?: ReactNode;
}) {
  return (
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      <div
        className="relative w-full h-full overflow-hidden transition-transform duration-300 ease-out"
        style={{
          transform: "rotateY(-4deg)",
          transformOrigin: "left center",
          borderRadius: `${borderRadius}px`,
          boxShadow: showShadow
            ? "1px 1px 0 rgba(255,255,255,0.1) inset, 4px 6px 14px rgba(0,0,0,0.45), 8px 14px 28px rgba(0,0,0,0.28)"
            : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
        {/* spine hinge highlight + adjacent crease shadow, painted onto the
            cover — this is what sells the "hardcover" illusion */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.28) 2%, rgba(0,0,0,0.14) 4%, rgba(0,0,0,0.36) 6%, rgba(0,0,0,0) 10%)",
          }}
        />
        {overlay}
      </div>
    </div>
  );
}
