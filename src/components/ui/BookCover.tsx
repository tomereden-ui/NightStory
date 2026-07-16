"use client";

import type { ReactNode } from "react";

// CSS book-cover treatment for existing flat cover art — no new images, no
// server work. Uses a 2D skew & scale technique rather than perspective +
// rotateY: the scrolling rails this renders inside (overflow-x-auto rows)
// were flattening real 3D transforms in some browser engines, and standard
// 2D transforms (skew/scale) can't be flattened by an ancestor's overflow
// the way 3D ones can, so this is the reliable fallback. The whole
// book-wrapper is skewed (.book-wrapper in globals.css, which also holds
// the hover lift — inline styles can't express :hover); cover and pages
// are plain absolutely-positioned siblings underneath that skew, with the
// pages' left edge tucked at 3% so nothing peeks out past the cover's
// spine on the left.
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
        {/* .book-pages — sits behind the cover */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "95%",
            height: "96.5%",
            top: "1.5%",
            left: "3%",
            zIndex: 1,
            backgroundColor: "#f4f2eb",
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0px, transparent 1px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)," +
              "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)",
            borderRadius: "0 4px 4px 0",
            boxShadow: showShadow
              ? "3px 3px 5px rgba(0,0,0,0.55), 10px 12px 20px rgba(0,0,0,0.4), 15px 20px 30px rgba(0,0,0,0.25)"
              : undefined,
          }}
        />
        {/* .book-cover — the front hardcover, leaves room on the right and bottom for the pages */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "95%",
            height: "96%",
            zIndex: 2,
            borderRadius: "4px 5px 5px 4px",
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.15), 3px 2px 6px rgba(0,0,0,0.4)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" onError={onImgError} />
          {/* .spine-crease */}
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
