"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Faithful implementation of the reference CSS the
// user supplied (.book-container / .book / .book-pages / .book-cover /
// .spine-crease), round two: rotateY(-8deg) rotateX(2deg) for a real
// angled-3D read, a 97%-wide front cover, and a pages block shifted 3% to
// the RIGHT so its paper edge extends past the container (right edge at
// 103%) — a fat 6% page peek beyond the cover. No back-cover board. The
// pages' bottom sits at 99% with the cover running the full 100% height,
// so the cover overhangs the pages at the bottom and no bottom stripe
// shows. Values match the reference — resist "improving" them.
//
// One deliberate deviation: the reference puts the pages' left edge at 3%,
// which lets paper peek through the notches left by the cover's rounded
// top-left/bottom-left corners (a white-pixel bug we hit before). The left
// edge is pulled in to 10% instead — with width adjusted so the right edge
// stays exactly at the reference's 103%.
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
   *  tighter, as in the reference (3px spine / 6px page edge). */
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
  const spineRadius = Math.max(2, borderRadius - 3);
  const pageRadius = Math.max(2, borderRadius - 2);

  return (
    // .book-container — establishes the 3D perspective
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1000 }}>
      {/* .book — the 3D angled book object */}
      <div
        className="relative w-full h-full transition-transform duration-[400ms] ease-out"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(-8deg) rotateX(2deg)" }}
      >
        {/* .book-pages — paper edge peeking out past the cover on the right;
            right edge intentionally extends 3% beyond the container, as in
            the reference */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "93%",
            height: "98%",
            top: "1%",
            left: "10%",
            zIndex: 1,
            background: "#f4f3ef",
            backgroundImage:
              "repeating-linear-gradient(to right, #f4f3ef 0px, #f4f3ef 2px, #e8e6df 3px, #e8e6df 4px)",
            borderRadius: `0 ${pageRadius}px ${pageRadius}px 0`,
            boxShadow: showShadow
              ? "3px 3px 8px rgba(0,0,0,0.5), 10px 15px 25px rgba(0,0,0,0.3), 15px 25px 45px rgba(0,0,0,0.15)"
              : undefined,
          }}
        />
        {/* .book-cover — the front cover hardback */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "97%",
            height: "100%",
            zIndex: 2,
            borderRadius: `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`,
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.2), 1px 3px 10px rgba(0,0,0,0.5)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
          {/* .spine-crease — the 3D spine bump and hinge crease */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.2) 2%, rgba(0,0,0,0.1) 4%, rgba(0,0,0,0.3) 6%, rgba(0,0,0,0) 9%)",
            }}
          />
          {overlay}
        </div>
      </div>
    </div>
  );
}
