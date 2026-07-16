"use client";

import type { ReactNode } from "react";

// CSS book-cover treatment for existing flat cover art — no new images, no
// server work. Uses a 2D skew & scale technique rather than perspective +
// rotateY: the scrolling rails this renders inside (overflow-x-auto rows)
// were suspected of flattening real 3D transforms in some browser engines,
// and standard 2D transforms (skew/scale) can't be flattened by an
// ancestor's overflow the way 3D ones can. The whole book-wrapper is
// skewed (.book-wrapper in globals.css, which also holds the hover lift —
// inline styles can't express :hover); cover and pages are plain
// absolutely-positioned siblings underneath that skew, with the pages'
// left edge tucked in just enough to stay hidden under the cover's spine
// on the left.
//
// skewY(ay) shifts a point's Y by x*tan(ay) — i.e. it shears based on
// horizontal position, not vertical — so the whole right edge of the
// (skewed) book translates vertically as one unit relative to the left
// edge, growing the bounding box by roughly width*tan(3.5deg) (≈8px at
// 130px wide, ≈16px at 260px wide). Box-shadow blur adds more on top of
// that. Callers MUST give this component's own box some breathing room in
// whatever scrolls/clips it (padding on a scrolling rail, gap in a grid) —
// see the -mt-4/-mb-4 + pt-4/pb-4 pattern on the rail containers in
// home/page.tsx and library/page.tsx. This component has no way to reserve
// that space itself since it always fills 100% of the box it's given.
//
// Do NOT append " !important" inside a React inline style value (e.g.
// width: "95% !important") to try to force-win a cascade fight — React
// assigns inline styles via direct DOM property setters (element.style.
// width = value), and browsers reject a value containing "!important"
// there as invalid syntax, silently dropping the whole declaration rather
// than applying it with elevated priority. That happened here once: it
// collapsed .book-cover and .book-pages to zero size (no explicit width/
// height at all) and every cover art image vanished, since the <img>
// inside sizes itself as 100% of a now-sizeless parent. If a real
// specificity conflict ever needs solving, use an !important rule in an
// actual stylesheet (globals.css), the same way .book-wrapper's hover
// transform does it correctly.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. Chrome that belongs physically ON the jacket (badge
// chips, avatar seal) goes through the `overlay` prop, rendered inside the
// cover box. Titles and metadata belong below the book in normal page
// flow, not overlaid here.
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
   *  per the design spec (4px 5px 5px 4px on the cover, 0 4px 4px 0 on
   *  the pages). */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Chrome that belongs physically ON the jacket (badge chips, avatar
   *  seal). Rendered inside the front-cover box so it stays pixel-aligned
   *  with the skewed cover. Titles/metadata belong below the book instead. */
  overlay?: ReactNode;
}) {
  return (
    // .book-container
    <div className={`relative w-full h-full ${className ?? ""}`}>
      {/* .book-wrapper — skewY(-3deg) scaleX(0.95); hover straightens + lifts via globals.css */}
      <div className="book-wrapper relative w-full h-full">
        {/* .book-pages — sits behind the cover. Sized visibly larger than
            the cover (not the same width) so a real margin of paper shows
            on the right and bottom — at equal widths the "peek" was just a
            few px, too thin to read as a page block at all. */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "97%",
            height: "97.5%",
            top: "1%",
            left: "2px",
            zIndex: 1,
            backgroundColor: "#f4f2eb",
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0px, transparent 1px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)," +
              "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)",
            borderRadius: "0 4px 4px 0",
            boxShadow: showShadow
              ? "2px 2px 5px rgba(0,0,0,0.5), 8px 10px 18px rgba(0,0,0,0.35), 12px 18px 25px rgba(0,0,0,0.2)"
              : undefined,
          }}
        />
        {/* .book-cover — the front hardcover. Narrower than the pages
            behind it (92% vs 97%) so a genuine, visible strip of paper
            shows on the right and bottom instead of a hairline. */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "92%",
            height: "95%",
            zIndex: 2,
            borderRadius: "4px 6px 6px 4px",
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.2), 3px 2px 6px rgba(0,0,0,0.45)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
          {/* .spine-crease — left edge (the hinge) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 3,
              background:
                "linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.15) 1.5%, rgba(0,0,0,0.08) 3%, rgba(0,0,0,0.25) 4.5%, rgba(0,0,0,0) 7%)",
            }}
          />
          {/* Right-edge blend — a soft shadow fading in from the right so
              the artwork visually recedes INTO the page block behind it
              instead of ending in a hard, disconnected line. Mirrors the
              spine-crease's approach on the opposite edge. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 3,
              background:
                "linear-gradient(to left, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.08) 3%, rgba(0,0,0,0) 9%)",
            }}
          />
          {overlay}
        </div>
      </div>
    </div>
  );
}
