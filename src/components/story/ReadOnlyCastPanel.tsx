"use client";

import { useState } from "react";
import type { ScriptBlock } from "@/types";

type CharacterType = "child" | "adult" | "animal" | "narrator";

function buildAvatarUrl(characterName: string, type: CharacterType): string {
  const seed = encodeURIComponent(characterName);
  const bg = "0d1b4a";
  switch (type) {
    case "child":    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}`;
    case "animal":   return `https://api.dicebear.com/9.x/croodles/svg?seed=${seed}&backgroundColor=${bg}&scale=90`;
    case "narrator": return `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&backgroundColor=${bg}`;
    default:         return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=${bg}&scale=90`;
  }
}

const ANIMAL_WORDS = /bear|dog|cat|wolf|fox|rabbit|bunny|bird|fish|lion|tiger|elephant|monkey|frog|owl|pig|duck|horse|mouse|rat|snake|dragon|dino|snake|turtle/i;

function inferCharacterType(name: string): CharacterType {
  if (name === "Narrator" || name === "קריין") return "narrator";
  if (ANIMAL_WORDS.test(name)) return "animal";
  return "child";
}

export default function ReadOnlyCastPanel({
  blocks,
  characterAvatars,
}: {
  blocks: ScriptBlock[];
  /** Real avatar-bank portraits, keyed by characterName — same map already
   * resolved for the script/dialogue cards (see characterAvatars.ts). When a
   * character isn't in it (bank still loading, or empty), falls back to a
   * deterministic DiceBear placeholder so the row never looks broken. */
  characterAvatars?: Record<string, string>;
}) {
  const cast = Array.from(
    blocks
      .filter((b) => b.characterName !== "SFX")
      .reduce<Map<string, string>>((map, b) => {
        if (!map.has(b.characterName)) {
          const bankUrl = characterAvatars?.[b.characterName];
          const type = inferCharacterType(b.characterName);
          map.set(b.characterName, bankUrl || buildAvatarUrl(b.characterName, type));
        }
        return map;
      }, new Map())
      .entries(),
  );

  if (cast.length === 0) return null;

  return (
    <div className="mb-1">
      <p className="text-fs-body font-bold uppercase tracking-widest mb-3 px-5" style={{ color: "rgba(79,195,247,0.45)" }}>
        Cast
      </p>
      <div
        className="flex gap-3 pb-2 -mx-0 px-5"
        style={{ overflowX: "scroll", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {cast.map(([characterName, avatarUrl]) => (
          <ReadOnlyCharacterCard key={characterName} characterName={characterName} avatarUrl={avatarUrl} />
        ))}
      </div>
    </div>
  );
}

function ReadOnlyCharacterCard({ characterName, avatarUrl }: { characterName: string; avatarUrl: string }) {
  const [imgError, setImgError] = useState(false);
  const isNarrator = characterName === "Narrator";
  const accentColor = isNarrator ? "rgba(167,139,250,0.7)" : "rgba(79,195,247,0.7)";

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: 68 }}>
      <div
        className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={characterName}
            className="w-full h-full object-cover"
            // Avatar-bank portraits are bust shots on a starry background —
            // the raw frame often catches a plain/light patch right at the
            // shoulders. Zooming in and biasing the crop toward the top
            // keeps the face centered and pushes that area out of frame.
            style={{ transform: "scale(1.45)", objectPosition: "50% 15%" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))" }}>
            <span className="text-fs-heading font-bold" style={{ color: accentColor }}>{characterName.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <p className="text-center text-fs-body font-medium leading-tight" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 68 }}>
        {characterName}
      </p>
    </div>
  );
}
