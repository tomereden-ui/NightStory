"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

// Replaces the old BookCover skeuomorph (spine, page stack, cover-jacket
// tilt) with a tvOS/Netflix-style "focus poster": a plain rounded-rect
// image plate that grows and tilts toward the pointer on hover, with a
// cursor-tracked glare and a glow-tinted shadow blooming underneath as it
// lifts. On touch (no real hover), a press stands in for it — tilt toward
// wherever the finger landed, hold the focused look briefly so it's
// actually visible, then settle back on release. touchmove is left alone
// so scrolling a rail this sits inside still works normally.
//
// Growth (scale) and tilt (rotateX/rotateY) are deliberately driven by two
// DIFFERENT elements — an outer div (React state, CSS transition) for
// scale, an inner ref'd div (direct DOM mutation on every mousemove, no
// re-render) for tilt — because both live on the same CSS `transform`
// property; if they shared one element, whichever set `transform` last
// would silently clobber the other instead of composing.
//
// Real 3D perspective/rotateX/rotateY, not the old book's 2D skew: this
// component renders inside overflow-x-auto rails (home/library), and the
// PREVIOUS book version specifically avoided 3D transforms because some
// browser engines were found to flatten them under a scrolling ancestor.
// That was verified against this repo's actual rails in Chromium — it
// renders correctly there — but wasn't re-verified in Safari/iOS, which is
// where that historical flattening bug actually lived. Spot-check on an
// iPhone before treating this as final; if it turns out 3D still gets
// flattened there, the grow+shadow+glare (all plain 2D) still carry the
// effect on their own and nothing looks broken, just less dimensional.
export default function StoryPoster({
  coverUrl,
  alt,
  showShadow = true,
  className,
  onImgError,
  overlay,
  borderRadius = 14,
  focusX,
  focusY,
}: {
  coverUrl?: string;
  alt: string;
  /** Corner radius in px — same value used for the plate, the image, and
   *  the shadow-casting layer so they stay pixel-aligned. */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Chrome that belongs physically ON the poster (badge chips, avatar
   *  seal). Rendered inside the image box. Titles/metadata belong below
   *  the poster in normal page flow, not overlaid here. */
  overlay?: ReactNode;
  /** Percentages (0-100) — same custom focus point set in Studio (see
   *  ScriptTab's cover-focus picker) and already respected by the home
   *  hero banner, so a cropped poster keeps the same framing everywhere
   *  instead of falling back to a blind center-crop. Defaults to 50/30,
   *  matching generated covers' face position (top ~15-45%). */
  focusX?: number;
  focusY?: number;
}) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);

  const applyTilt = useCallback((clientX: number, clientY: number, fast: boolean) => {
    const el = tiltRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (clientX - r.left) / r.width;
    const py = (clientY - r.top) / r.height;
    const rx = (0.5 - py) * 14;
    const ry = (px - 0.5) * 18;
    el.style.transition = fast ? "transform 60ms linear" : "transform .6s cubic-bezier(.22,.9,.3,1)";
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  }, []);

  const resetTilt = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transition = "transform .6s cubic-bezier(.22,.9,.3,1)";
    el.style.transform = "rotateX(0deg) rotateY(0deg)";
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    setActive(true);
    const t = e.touches[0];
    if (t) applyTilt(t.clientX, t.clientY, true);
  };
  const releaseTouch = () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => {
      setActive(false);
      resetTilt();
    }, 450);
  };

  return (
    <div
      className={`relative w-full h-full ${className ?? ""}`}
      style={{
        transform: active ? "scale(1.08)" : "scale(1)",
        transformOrigin: "center 60%",
        transition: "transform .45s cubic-bezier(.34,1.4,.4,1)",
        // Grown card needs to paint over its still-flat siblings in a grid/
        // rail — later DOM elements otherwise cover it regardless of scale.
        zIndex: active ? 20 : undefined,
      }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => { setActive(false); resetTilt(); }}
      onMouseMove={(e) => applyTilt(e.clientX, e.clientY, true)}
      onTouchStart={handleTouchStart}
      onTouchEnd={releaseTouch}
      onTouchCancel={releaseTouch}
    >
      {/* Glow-tinted contact shadow — blooms and spreads as the poster lifts. */}
      {showShadow && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: "10%",
            right: "10%",
            bottom: "-10%",
            height: "22%",
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(79,195,247,0.5), transparent 72%)",
            filter: active ? "blur(18px)" : "blur(9px)",
            opacity: active ? 0.85 : 0.4,
            transform: active ? "scaleY(1.25)" : "scaleY(1)",
            transition: "filter .45s ease, opacity .45s ease, transform .45s ease",
          }}
        />
      )}

      {/* perspective only takes effect on a CHILD's 3D transform, never on
          the element it's declared on — it has to live one level up from
          tiltRef, which is the element whose rotateX/rotateY actually get
          mutated on every mousemove. Collapsing these into one div renders
          a flat orthographic tilt (foreshortening with no vanishing point)
          instead of true perspective depth. */}
      <div className="relative w-full h-full" style={{ perspective: 700 }}>
        <div
          ref={tiltRef}
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius,
              boxShadow: showShadow
                ? active
                  ? "0 26px 40px -14px rgba(79,195,247,0.55), 0 10px 18px -4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.1)"
                  : "0 10px 20px -8px rgba(0,0,0,0.55), 0 3px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.07)"
                : undefined,
              transition: "box-shadow .45s ease",
            }}
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={alt}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: `${focusX ?? 50}% ${focusY ?? 30}%` }}
                onError={onImgError}
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "linear-gradient(150deg,#1a1040 0%,#0d1230 45%,#040612 100%)" }}
              >
                <span style={{ fontSize: "34%", filter: "drop-shadow(0 0 12px rgba(167,139,250,0.5))" }}>✨</span>
              </div>
            )}

            {/* Cursor-tracked glare — a soft light patch sweeping across the
                surface, the glossy-poster cue from tvOS's focus effect. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(circle at var(--mx,50%) var(--my,20%), rgba(255,255,255,0.5), transparent 45%)",
                mixBlendMode: "soft-light",
                opacity: active ? 1 : 0,
                transition: "opacity .3s ease",
              }}
            />
            {/* Static rim light — a hint of top-left sheen at rest, so the
                poster reads as glossy even before it's touched. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(150deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 30%)" }}
            />
            {overlay}
          </div>
        </div>
      </div>
    </div>
  );
}
