"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Two stacked layers create the "hardcover"
// illusion: a thin cream "pages" panel behind the actual front-cover image,
// the image sized slightly smaller so a sliver of pages peeks out on the
// right and bottom. Corners are uniformly rounded on both layers (matching
// the reference photo this was calibrated against — a soft all-around
// rounded edge, not a flat squared-off spine). A slight whole-group tilt
// (rotateY, anchored at the left/spine edge) and a drop shadow finish the
// illusion. Percentages mean every dimension is already proportional to
// this component's own size, so it holds up at any card size without a
// fixed px calibration.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. Any title/gradient/badge chrome that needs to sit ON
// the cover must go through the `overlay` prop (rendered inside the same
// box as the front-cover image) rather than a separate sibling, so it can
// never drift out of alignment with the tilted image.
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
  const cornerRadii = `${borderRadius}px`;

  return (
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      <div className="relative w-full h-full transition-transform duration-300 ease-out" style={{ transform: "rotateY(-6deg)", transformOrigin: "left center" }}>
        {/* pages — thin cream panel behind the front cover, peeking out on the right and bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: cornerRadii,
            background: "#f6f4ef",
            backgroundImage:
              "repeating-linear-gradient(to bottom, #f6f4ef 0px, #f6f4ef 1px, #ddd7c6 2px, #ddd7c6 3px)",
            boxShadow: showShadow ? "2px 3px 8px rgba(0,0,0,0.35), 5px 8px 18px rgba(0,0,0,0.2)" : undefined,
          }}
        />
        {/* front cover — the actual art, slightly smaller than the pages panel behind it */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "95%",
            height: "96%",
            borderRadius: cornerRadii,
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
    </div>
  );
}
