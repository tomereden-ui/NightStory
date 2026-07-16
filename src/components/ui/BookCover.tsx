"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Three stacked layers create the "hardcover"
// illusion: a thin colored strip standing in for the back cover, a thin
// cream "pages" strip in front of that, and the actual front-cover image on
// top — each slightly narrower than the last, so a sliver of each peeks out
// on the right. Critically the peek is ONLY on the right, never the bottom:
// earlier rounds let the pages layer peek out the bottom too, and across
// several rounds of feedback that bottom sliver kept reading as a
// distracting stripe rather than a paper hint, while the right-edge-only
// peek is what actually reads as "hardcover depth" without it. A slight
// whole-group tilt (rotateY, anchored at the left/spine edge) and a drop
// shadow finish the illusion. Percentages mean every dimension is already
// proportional to this component's own size, so it holds up at any card
// size without a fixed px calibration.
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
  // Left corners stay near-square (that's the spine/hinge), right corners
  // keep the full requested radius (that's the page edge).
  const spineRadius = Math.max(2, borderRadius - 4);
  const cornerRadii = `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`;

  return (
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      <div className="relative w-full h-full transition-transform duration-300 ease-out" style={{ transform: "rotateY(-6deg)", transformOrigin: "left center" }}>
        {/* back cover — thin colored sliver, outermost/rightmost layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: cornerRadii,
            background: "linear-gradient(115deg, #9a7830 0%, #b8934a 55%, #8a6a28 100%)",
            boxShadow: showShadow ? "3px 3px 8px rgba(0,0,0,0.4), 6px 10px 20px rgba(0,0,0,0.22)" : undefined,
          }}
        />
        {/* pages — thin cream sliver, sits between the back cover and the front cover */}
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width: "98%",
            height: "100%",
            borderRadius: cornerRadii,
            background: "#f4f3ef",
            backgroundImage:
              "repeating-linear-gradient(to bottom, #f4f3ef 0px, #f4f3ef 1px, #ddd7c6 2px, #ddd7c6 3px)",
            boxShadow: "2px 2px 5px rgba(0,0,0,0.3)",
          }}
        />
        {/* front cover — the actual art, narrowest layer so the two slivers above peek out on the right */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "95.5%",
            height: "100%",
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
