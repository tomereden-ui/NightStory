"use client";

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
// a duplicate-declaration fallback correctly.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. The parent container keeps its sizing (width/height or
// aspectRatio) but must NOT also clip with `overflow-hidden` — the pages
// layer peeks a couple percent past the cover's right edge by design.
export default function BookCover({
  coverUrl,
  alt,
  borderRadius = 6,
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
  const spineRadius = Math.max(2, borderRadius - 2);

  return (
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 1200 }}>
      <div
        className="relative w-full h-full transition-transform duration-300 ease-out"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(-9deg) rotateX(1.5deg)" }}
      >
        {/* pages — flat, slightly larger on the right AND bottom edges (a
            book's fore-edge and tail — the two edges that actually show
            stacked paper; the spine/left and head/top stay flush) */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "1%", left: "1%", width: "99%", height: "99%",
            zIndex: 1,
            borderRadius: `0 ${borderRadius}px ${borderRadius}px 0`,
            background: "#f4f3ef",
            backgroundImage: "repeating-linear-gradient(to right, #f4f3ef 0px, #f4f3ef 1px, #ddd7c6 2px, #ddd7c6 3px)",
            boxShadow: showShadow
              ? "4px 3px 6px rgba(0,0,0,0.55), 9px 9px 18px rgba(0,0,0,0.4), 14px 18px 32px rgba(0,0,0,0.22)"
              : undefined,
          }}
        />

        {/* front cover — the real image, narrower/shorter than the
            container so the pages layer shows on the right and bottom */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: 0, left: 0, width: "92%", height: "96%",
            zIndex: 2,
            borderRadius: `${spineRadius}px ${borderRadius}px ${borderRadius}px ${spineRadius}px`,
            boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.18), 3px 2px 7px rgba(0,0,0,0.5)",
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
        </div>
      </div>
    </div>
  );
}
