"use client";

import type { ReactNode } from "react";

// Pure-CSS 3D book-cover treatment for existing flat cover art — no new
// images, no server work. Structure and values follow the user's exact
// spec value-for-value:
//   .book-container — perspective: 1000px, perspective-origin 50% 50%,
//     AND transform-style: preserve-3d on the container itself (not just
//     the .book-3d child), so nothing upstream can flatten the 3D space.
//   .book-3d — rotateY(-8deg) rotateX(1deg); hover lifts + straightens
//     with translateZ(10px) (globals.css — inline styles can't do :hover).
//   .book-cover — 96% x 97%, pushed forward with translateZ(4px) so it
//     physically sits in front of the pages in 3D space, not just via
//     z-index.
//   .book-pages — 94% x 96%, inset 3%/1%, translateZ(0) (stays at the
//     book's base depth), dual-direction page-line texture, three-layer
//     shadow stack.
//   .spine-crease — unchanged spine ridge + hinge gradient on the cover.
//
// Usage: swap an existing `<img className="absolute inset-0 w-full h-full
// object-cover" src={coverUrl} />` for `<BookCover coverUrl={coverUrl}
// alt={title} />`. Chrome that belongs physically ON the jacket (badge
// chips, avatar seal) goes through the `overlay` prop, rendered inside the
// cover box so it moves with the translateZ-pushed front face. Titles and
// metadata belong below the book in normal page flow, not overlaid here.
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
   *  per the design spec (4px 6px 6px 4px on the cover, 0 4px 4px 0 on
   *  the pages). */
  borderRadius?: number;
  showShadow?: boolean;
  className?: string;
  /** Forwarded to the inner <img>'s onError, same as callers used to attach
   *  directly (e.g. classics falling back to an emoji placeholder). */
  onImgError?: () => void;
  /** Chrome that belongs physically ON the jacket (badge chips, avatar
   *  seal). Rendered inside the front-cover box so it stays pixel-aligned
   *  with the translateZ-pushed cover. Titles/metadata belong below the
   *  book instead. */
  overlay?: ReactNode;
}) {
  return (
    // .book-container
    <div
      className={`relative w-full h-full ${className ?? ""}`}
      style={{
        perspective: 1000,
        perspectiveOrigin: "50% 50%",
        transformStyle: "preserve-3d",
      }}
    >
      {/* .book-3d — rotateY(-8deg) rotateX(1deg); hover lift via globals.css */}
      <div className="book-3d relative w-full h-full">
        {/* .book-pages — sits behind the cover, at the book's base depth */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "94%",
            height: "96%",
            top: "1%",
            left: "3%",
            zIndex: 1,
            transform: "translateZ(0px)",
            backgroundColor: "#f5f2eb",
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0px, transparent 1px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)," +
              "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)",
            borderRadius: "0 4px 4px 0",
            boxShadow: showShadow
              ? "2px 2px 4px rgba(0,0,0,0.5), 8px 10px 20px rgba(0,0,0,0.35), 12px 18px 28px rgba(0,0,0,0.2)"
              : undefined,
          }}
        />
        {/* .book-cover — pushed forward along Z so it physically sits in
            front of the pages, not just via z-index */}
        <div
          className="absolute top-0 left-0 overflow-hidden"
          style={{
            width: "96%",
            height: "97%",
            zIndex: 2,
            transform: "translateZ(4px)",
            borderRadius: "4px 6px 6px 4px",
            boxShadow:
              "inset 1px 1px 1px rgba(255,255,255,0.15), 3px 0px 8px rgba(0,0,0,0.4)",
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
