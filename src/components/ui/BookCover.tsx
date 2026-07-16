"use client";

import type { CSSProperties } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. A perspective group holds three pieces: the
// front cover (the real coverUrl image, clipped to its own rounded
// corners), a spine strip folded back along the left edge via
// rotateY(90deg), and two paper-edge slivers folded back along the right
// and bottom edges the same way. The drop shadow sits outside the rotated
// group so perspective doesn't distort it.
//
// The actual size-dependent CSS (perspective, spine/page thickness,
// translateZ, in container-query cqw units with a px fallback) lives in
// src/app/globals.css under "3D book-cover treatment" — see that comment
// for why cqw matters here: a fixed-px spine looks bold on a small card
// and vanishes on a big one, so every dimension scales with this
// component's OWN rendered width instead.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. The parent container keeps its sizing (width/height or
// aspectRatio) but must NOT also clip with `overflow-hidden` or carry its
// own `rounded-*` class — the spine/page slivers extend past the flat
// image bounds by design, and BookCover's own front-cover element already
// owns the rounding/clipping for the image itself.
export default function BookCover({
  coverUrl,
  alt,
  borderRadius = 8,
  showShadow = true,
  className,
  onImgError,
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
}) {
  const radiusVars = { "--book-radius": `${borderRadius}px` } as CSSProperties;

  return (
    <div className={`book-cover-scene relative w-full h-full ${className ?? ""}`}>
      <div className="book-cover-perspective relative w-full h-full">
        <div className="book-cover-group relative w-full h-full">
          {/* spine — folded back along the left edge */}
          <div className="book-cover-spine absolute pointer-events-none" style={{ left: 0, top: "2%", bottom: "2%", ...radiusVars }}>
            <div className="book-cover-spine-highlight absolute" style={{ top: "8%", bottom: "8%" }} />
          </div>

          {/* pages — folded back along the right edge */}
          <div className="book-cover-pages-right absolute pointer-events-none" style={{ right: 0, top: "3%", bottom: "3%" }} />

          {/* pages — folded back along the bottom edge */}
          <div className="book-cover-pages-bottom absolute pointer-events-none" style={{ left: "2%", bottom: 0 }} />

          {/* front cover */}
          <div className="book-cover-front absolute inset-0" style={radiusVars}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
            {/* glossy highlight */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 16%, transparent 38%)" }}
            />
            {/* inner edge shading toward the spine, for depth */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset -3px 0 6px rgba(0,0,0,0.26)" }} />
          </div>
        </div>
      </div>

      {showShadow && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            bottom: "-8%", height: "20%",
            background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(0,0,0,0.5), rgba(0,0,0,0) 72%)",
            filter: "blur(2px)",
          }}
        />
      )}
    </div>
  );
}
