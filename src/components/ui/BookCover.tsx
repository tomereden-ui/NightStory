"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. This is a faithful implementation of the
// reference CSS the user supplied (.book-container / .book / .book-pages /
// .book-cover / .spine-crease): a warm paper "pages" block sits behind the
// cover, inset 1% and 98% wide/tall so its right edge peeks out past the
// narrower (96%) front cover; vertical repeating lines on it simulate the
// stacked page edges; the whole book leans a very slight rotateY(-4deg);
// the cover carries a rim-light inset shadow plus a shadow falling onto
// the pages, and the spine crease is a soft highlight-then-shadow gradient
// along the left edge. Values match the reference — resist "improving"
// them; earlier rounds that strengthened tilt/peek/contrast all read worse.
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
        {/* .book-pages — the physical paper edge revealed on the right */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "98%",
            height: "98%",
            top: "1%",
            left: "1%",
            zIndex: 1,
            background: "#f4f3ef",
            backgroundImage:
              "repeating-linear-gradient(to right, #f4f3ef 0px, #f4f3ef 1px, #e3dfd5 2px, #e3dfd5 3px)",
            borderRadius: `0 ${spineRadius}px ${spineRadius}px 0`,
            boxShadow: showShadow
              ? "3px 2px 5px rgba(0,0,0,0.5), 8px 8px 16px rgba(0,0,0,0.35), 12px 16px 28px rgba(0,0,0,0.2)"
              : undefined,
          }}
        />
        {/* .book-cover — the front cover hardback, slightly narrower so the
            pages show on the right */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "96%",
            height: "100%",
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
