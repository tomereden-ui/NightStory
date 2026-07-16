"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Two flat, percentage-sized layers plus a subtle
// whole-group tilt: a "pages" rectangle (warm paper color, striped to
// suggest stacked page edges) sits behind and slightly larger than the
// front cover, so it peeks out on the right; the front cover is the real
// coverUrl image with a spine-crease gradient painted directly onto it
// (a highlight next to a shadow, right where a hardcover's hinge would
// be) rather than a separate 3D-rotated panel. Percentages mean every
// dimension is already proportional to this component's own size — no
// container queries, no fixed-px thicknesses that only look right at one
// size, no relying on browsers (or the build's CSS minifier) to preserve
// a duplicate-declaration fallback correctly. Rotation is anchored at the
// left edge (transformOrigin "left center") — a book hinges at its spine,
// not its center, so the left edge stays put and only the right recedes.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. The parent container keeps its sizing (width/height or
// aspectRatio) but must NOT also clip with `overflow-hidden` — the pages
// layer peeks past the cover's right/bottom edges by design. Any title/
// gradient/badge chrome that needs to sit ON the cover must go through the
// `overlay` prop (rendered inside the same box as the image) rather than
// a separate sibling positioned at inset-0 — the cover is intentionally
// smaller than the full container (to reveal the pages behind it), so an
// external overlay sized to the old full-bleed bounds visibly misaligns
// with the actual displayed image.
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
  /** Matches whatever rounding the surface used on its old flat <img>. */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Title/gradient/badge chrome rendered on top of the image, inside the
   *  same tilted+inset front-cover box so it can never drift out of
   *  alignment with the displayed cover. */
  overlay?: ReactNode;
}) {
  const spineRadius = Math.max(2, borderRadius - 2);

  return (
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      <div
        className="relative w-full h-full transition-transform duration-300 ease-out"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(-5deg) rotateX(1deg)", transformOrigin: "left center" }}
      >
        {/* pages — flat, JUST slightly larger on the right and bottom edges
            (a book's fore-edge and tail) — a thin hint of stacked paper,
            not a wide visible border. */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "0.5%", left: "0.5%", width: "99.5%", height: "99.5%",
            zIndex: 1,
            borderRadius: `0 ${borderRadius}px ${borderRadius}px 0`,
            background: "#f4f3ef",
            backgroundImage: "repeating-linear-gradient(to right, #f4f3ef 0px, #f4f3ef 1px, #ddd7c6 2px, #ddd7c6 3px)",
            boxShadow: showShadow
              ? "3px 2px 5px rgba(0,0,0,0.5), 7px 7px 14px rgba(0,0,0,0.32), 11px 14px 24px rgba(0,0,0,0.18)"
              : undefined,
          }}
        />

        {/* front cover — the real image, JUST slightly narrower/shorter
            than the container so only a thin sliver of pages shows */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: 0, left: 0, width: "97%", height: "98.5%",
            zIndex: 2,
            borderRadius: `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`,
            boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.18), 2px 1px 5px rgba(0,0,0,0.45)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={alt} className="w-full h-full object-cover" onError={onImgError} />
          {/* spine hinge highlight + adjacent crease shadow, painted onto
              the cover — this (not a rotated 3D panel) is what sells the
              "hardcover" illusion */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.3) 2%, rgba(0,0,0,0.16) 4%, rgba(0,0,0,0.42) 6%, rgba(0,0,0,0) 10%)",
            }}
          />
          {overlay}
        </div>
      </div>
    </div>
  );
}
