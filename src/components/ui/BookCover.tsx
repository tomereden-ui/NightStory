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
// edge, growing the bounding box by roughly width*tan(3.5deg) (≈6.1% of
// width, at any card size). Box-shadow reach adds more on top of that,
// toward the right and bottom.
//
// This used to be the caller's problem — every rail/grid that renders a
// BookCover had to remember to add exactly the right padding around it, in
// px, tuned per card size. That went through two rounds of "still clipping"
// before landing here instead: the component now reserves its own
// breathing room via PERCENTAGE padding on book-container. Percentage
// padding resolves against the parent's WIDTH for all four sides (a real,
// if obscure, CSS rule — see CSS2.1 §10.2), which is exactly the quantity
// the skew excursion scales with, so this stays correct at every card size
// this component is used at without any caller-side tuning. Only top+right
// get padding — the LEFT edge sits at the transform-origin ("left center"),
// so skewY/scaleX leave it stationary (dy = 0*tan(ay) = 0), and the bottom
// doesn't need it since the shadow's offset is down-RIGHT, not down-left.
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
//
// coverUrl is optional — omit it for a "not written yet" book (e.g. the
// placeholder shown before a story exists in Studio): a soft cosmic
// gradient renders in place of the <img>, everything else (spine, page
// stack, tilt, shadow) stays identical.
export default function BookCover({
  coverUrl,
  alt,
  showShadow = true,
  className,
  onImgError,
  overlay,
}: {
  coverUrl?: string;
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
    // .book-container — reserves room for the skew's own overflow (see the
    // header comment) via percentage padding, so book-wrapper below
    // naturally renders inset from the top/right by the right amount at any
    // size, with zero per-caller tuning needed.
    <div
      className={`relative w-full h-full ${className ?? ""}`}
      style={{ boxSizing: "border-box", paddingTop: "8%", paddingRight: "10%" }}
    >
      {/* .book-wrapper — skewY(-3deg) scaleX(0.95); hover straightens + lifts via globals.css */}
      <div className="book-wrapper relative w-full h-full">
        {/* .book-pages — sits behind the cover. This used to be a flat,
            solid cream rectangle (#f4f2eb) — at any width that reads as a
            pasted-on slab, not paper, because real page edges aren't a
            uniform color: they're shadowed where they tuck under the cover
            and catch light further out. A gradient now does that (darker/
            muted near the seam → brighter cream outward), and the peek
            itself is much thinner (98.5%/98.8% vs the cover's 95.5%/97% —
            was 97%/97.5% vs 92%/95%, roughly double the gap) so it reads as
            an edge, not a block. Carries the book's ONE outer shadow — see
            the note on .book-cover below for why the cover doesn't have
            its own competing shadow. */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "98.5%",
            height: "98.8%",
            top: "0.5%",
            left: "2px",
            zIndex: 1,
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0px, transparent 1px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 3px)," +
              "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 3px)," +
              "linear-gradient(to right, #cfc7ae 0%, #ece7d6 35%, #f6f3e9 100%)",
            borderRadius: "0 4px 4px 0",
            boxShadow: showShadow
              ? "3px 4px 8px rgba(0,0,0,0.45), 10px 14px 24px rgba(0,0,0,0.3), 16px 24px 40px rgba(0,0,0,0.15)"
              : undefined,
          }}
        />
        {/* .book-cover — the front hardcover. Narrower than the pages
            behind it (95.5% vs 98.5% — was 92% vs 97%, a much wider gap
            that read as a chunky slab rather than a page edge) so a thin,
            believable strip of paper shows on the right and bottom.
            Corners are asymmetric on purpose: the left (spine) side gets a
            5px round to soften it into a curve; the right side is
            perfectly sharp (0) since that's a clean seam against the page
            stack, not an outer corner. Only carries an INSET rim-light
            now, not its own outer shadow — a second outer shadow here
            duplicated/fought the .book-pages shadow below it and read as a
            muddy, flat box outline instead of one coherent cast shadow. */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "95.5%",
            height: "97%",
            zIndex: 2,
            borderRadius: "5px 0 0 5px",
            boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.2)",
          }}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "linear-gradient(150deg,#1a1040 0%,#0d1230 45%,#040612 100%)" }}
            >
              <span style={{ fontSize: "34%", filter: "drop-shadow(0 0 12px rgba(167,139,250,0.5))" }}>✨</span>
            </div>
          )}
          {/* .spine-crease — the highlight used to start at full brightness
              exactly at x=0, a hard jump from "nothing" to "bright" right at
              the box's own edge that read as a flat cut line rather than a
              curve. A real rounded spine's outermost edge curves AWAY from
              the light before the ridge — so this now dips dark first (the
              curve receding), rises to the highlight ridge a little inward,
              then falls into the hinge crease before fading out. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 3,
              background:
                "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.08) 0.8%, rgba(255,255,255,0.42) 2%, rgba(0,0,0,0.15) 3.5%, rgba(0,0,0,0.5) 6%, rgba(0,0,0,0.16) 7.5%, rgba(0,0,0,0) 9%)",
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
