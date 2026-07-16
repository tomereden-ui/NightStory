"use client";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. A perspective group holds three pieces: the
// front cover (the real coverUrl image, clipped to its own rounded
// corners), a spine strip folded back along the left edge via
// rotateY(90deg), and two paper-edge slivers folded back along the right
// and bottom edges the same way. The drop shadow sits outside the rotated
// group so perspective doesn't distort it.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. The parent container keeps its sizing (width/height or
// aspectRatio) but must NOT also clip with `overflow-hidden` or carry its
// own `rounded-*` class — the spine/page slivers extend a few pixels past
// the flat image bounds by design, and BookCover's own front-cover element
// already owns the rounding/clipping for the image itself.
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
  return (
    <div className={`relative w-full h-full ${className ?? ""}`} style={{ perspective: 900, perspectiveOrigin: "50% 40%" }}>
      <div
        className="relative w-full h-full transition-transform duration-300 ease-out"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(-16deg) rotateX(2.5deg)" }}
      >
        {/* spine — folded back along the left edge */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: 0, top: "2%", bottom: "2%", width: 12,
            transformOrigin: "left center",
            transform: "rotateY(90deg) translateZ(-6px)",
            borderRadius: `${borderRadius}px 0 0 ${borderRadius}px`,
            background: "linear-gradient(180deg, #322a52 0%, #1c1836 55%, #100e20 100%)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="absolute"
            style={{
              left: 2, top: "8%", bottom: "8%", width: 2, borderRadius: 2,
              background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 65%)",
            }}
          />
        </div>

        {/* pages — folded back along the right edge */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: 0, top: "3%", bottom: "3%", width: 6,
            transformOrigin: "right center",
            transform: "rotateY(-90deg) translateZ(3px)",
            borderRadius: `0 3px 3px 0`,
            background: "repeating-linear-gradient(180deg, #f3ead9 0px, #f3ead9 2px, #e2d5b8 2px, #e2d5b8 3px)",
          }}
        />

        {/* pages — folded back along the bottom edge */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "2%", right: 6, bottom: 0, height: 6,
            transformOrigin: "bottom center",
            transform: "rotateX(-90deg) translateZ(3px)",
            borderRadius: `0 0 3px 3px`,
            background: "repeating-linear-gradient(90deg, #f3ead9 0px, #f3ead9 2px, #e2d5b8 2px, #e2d5b8 3px)",
          }}
        />

        {/* front cover */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: `${borderRadius}px ${borderRadius + 2}px ${borderRadius + 2}px ${borderRadius}px`, transform: "translateZ(0)" }}
        >
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
