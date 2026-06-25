"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function Star({ x, y, size, delay, duration }: { x: number; y: number; size: number; delay: number; duration: number }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: "white",
        opacity: 0,
        animation: `ns-twinkle ${duration}s ${delay}s ease-in-out infinite`,
      }}
    />
  );
}

function WandSparkle({ angle, delay }: { angle: number; delay: number }) {
  const r = 30;
  const x = Math.cos((angle * Math.PI) / 180) * r;
  const y = Math.sin((angle * Math.PI) / 180) * r;
  return (
    <div
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{
        left: `calc(74% + ${x}px)`,
        top: `calc(36% + ${y}px)`,
        background: "#fbbf24",
        boxShadow: "0 0 8px 3px rgba(251,191,36,0.85)",
        opacity: 0,
        animation: `ns-sparkle 2.4s ${delay}s ease-in-out infinite`,
      }}
    />
  );
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  x: +((((i * 137.508) % 100)).toFixed(1)),
  y: +((((i * 94.27) % 100)).toFixed(1)),
  size: 1 + (i % 3),
  delay: +((i % 30) / 10).toFixed(1),
  duration: 2 + (i % 4),
}));

const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function SplashPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeOut = setTimeout(() => setVisible(false), 2600);
    const nav     = setTimeout(() => router.replace("/library"), 3100);
    return () => { clearTimeout(fadeOut); clearTimeout(nav); };
  }, [router]);

  return (
    <>
      <style>{`
        @keyframes ns-twinkle {
          0%,100% { opacity:0; transform:scale(0.4); }
          50%      { opacity:0.9; transform:scale(1); }
        }
        @keyframes ns-sparkle {
          0%,100% { opacity:0; transform:scale(0.3); }
          40%,60% { opacity:1; transform:scale(1); }
        }
        @keyframes ns-float {
          0%,100% { transform:translateY(0) rotate(-2deg); }
          50%      { transform:translateY(-14px) rotate(2deg); }
        }
        @keyframes ns-wand {
          0%,100% { filter:drop-shadow(0 0 20px rgba(251,191,36,.65)) drop-shadow(0 0 44px rgba(167,139,250,.45)); }
          50%      { filter:drop-shadow(0 0 36px rgba(251,191,36,1)) drop-shadow(0 0 70px rgba(167,139,250,.8)); }
        }
        @keyframes ns-shimmer {
          0%,100% { background-position:0% 50%; }
          50%      { background-position:100% 50%; }
        }
        @keyframes ns-moon {
          0%,100% { opacity:.7; transform:translateX(-50%) scale(1); }
          50%      { opacity:1; transform:translateX(-50%) scale(1.07); }
        }
        @keyframes ns-blink {
          0%,88%,100% { transform:scaleY(1); }
          94%          { transform:scaleY(0.06); }
        }
        @keyframes ns-fadein {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* Full-screen overlay — sits above AppShell nav */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
        style={{
          background: "radial-gradient(ellipse 110% 85% at 50% 28%, #1e1268 0%, #0c0628 45%, #050210 100%)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* Stars */}
        {STARS.map((s) => <Star key={s.id} {...s} />)}

        {/* Moon glow */}
        <div className="absolute rounded-full" style={{
          width: 200, height: 200, top: "6%", left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(255,245,200,.22) 0%, rgba(200,180,255,.09) 55%, transparent 80%)",
          animation: "ns-moon 4s ease-in-out infinite",
        }} />
        <div className="absolute rounded-full" style={{
          width: 80, height: 80, top: "9%", left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(255,248,210,.6) 0%, rgba(255,235,150,.22) 65%, transparent 100%)",
          boxShadow: "0 0 50px 24px rgba(255,235,150,.14)",
          animation: "ns-moon 4s ease-in-out infinite",
        }} />

        {/* OWL */}
        <div className="relative" style={{
          width: 270, height: 290,
          animation: "ns-float 5s ease-in-out infinite",
        }}>
          <div style={{ width: "100%", height: "100%", animation: "ns-wand 3s ease-in-out infinite, ns-fadein 0.9s 0.2s ease both" }}>
          <svg viewBox="0 0 270 290" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <defs>
              <radialGradient id="robe" cx="50%" cy="25%" r="70%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#1a0d70" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="faceGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6d5acd" />
                <stop offset="100%" stopColor="#3b28a0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Tail feathers */}
            <ellipse cx="118" cy="262" rx="13" ry="20" fill="#130958" transform="rotate(-10 118 262)" />
            <ellipse cx="135" cy="266" rx="13" ry="22" fill="#1a0d70" />
            <ellipse cx="152" cy="262" rx="13" ry="20" fill="#130958" transform="rotate(10 152 262)" />

            {/* Wings */}
            <ellipse cx="70" cy="205" rx="34" ry="50" fill="#130958" transform="rotate(14 70 205)" />
            <ellipse cx="200" cy="205" rx="34" ry="50" fill="#130958" transform="rotate(-14 200 205)" />
            <ellipse cx="72" cy="200" rx="26" ry="40" fill="#1e1278" transform="rotate(14 72 200)" />
            <ellipse cx="198" cy="200" rx="26" ry="40" fill="#1e1278" transform="rotate(-14 198 200)" />

            {/* Body / robe */}
            <ellipse cx="135" cy="215" rx="74" ry="58" fill="#1a0d70" />
            <ellipse cx="135" cy="208" rx="67" ry="52" fill="#2a1880" />
            <ellipse cx="135" cy="208" rx="67" ry="52" fill="url(#robe)" />
            {/* Robe stars */}
            {[[110,198],[152,208],[125,220],[144,194],[118,214],[158,195],[132,230]].map(([cx,cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={1.5 + (i % 2)} fill={i % 2 ? "#a78bfa" : "#c4b5fd"} opacity={0.55 + i*0.04} />
            ))}

            {/* Head */}
            <ellipse cx="135" cy="138" rx="60" ry="60" fill="#2a1880" />
            <ellipse cx="135" cy="135" rx="56" ry="57" fill="url(#faceGlow)" />

            {/* Ear tufts */}
            <path d="M98 90 L90 60 L112 80Z" fill="#1a0d70" />
            <path d="M172 90 L180 60 L158 80Z" fill="#1a0d70" />
            <path d="M100 89 L93 63 L113 81Z" fill="#4c3ab8" opacity="0.7" />
            <path d="M170 89 L177 63 L157 81Z" fill="#4c3ab8" opacity="0.7" />

            {/* Wizard hat */}
            <path d="M91 100 Q135 38 179 100Z" fill="#1a0d70" />
            <path d="M91 100 Q135 42 179 100Z" fill="#2a1880" opacity="0.7" />
            <ellipse cx="135" cy="100" rx="46" ry="11" fill="#2a1880" />
            <ellipse cx="135" cy="100" rx="46" ry="11" fill="#4c3ab8" opacity="0.4" />
            {/* Hat band */}
            <rect x="91" y="96" width="88" height="9" rx="4.5" fill="#7c3aed" opacity="0.55" />
            {/* Hat stars */}
            <circle cx="135" cy="68" r="4.5" fill="#a78bfa" filter="url(#glow)" />
            <circle cx="119" cy="83" r="2.8" fill="#c4b5fd" opacity="0.75" />
            <circle cx="150" cy="80" r="2.2" fill="#a78bfa" opacity="0.65" />

            {/* Face disc */}
            <ellipse cx="135" cy="142" rx="43" ry="43" fill="#3d2eaa" />
            <ellipse cx="135" cy="140" rx="40" ry="40" fill="#5040c0" opacity="0.7" />

            {/* Eye sockets */}
            <circle cx="112" cy="134" r="21" fill="#180e60" />
            <circle cx="158" cy="134" r="21" fill="#180e60" />
            {/* Iris amber */}
            <circle cx="112" cy="134" r="18" fill="#f59e0b" />
            <circle cx="158" cy="134" r="18" fill="#f59e0b" />
            <circle cx="112" cy="134" r="13" fill="#fbbf24" />
            <circle cx="158" cy="134" r="13" fill="#fbbf24" />
            {/* Pupils */}
            <circle cx="112" cy="134" r="8" fill="#1a0800" style={{ transformOrigin: "112px 134px", animation: "ns-blink 5s ease-in-out infinite" }} />
            <circle cx="158" cy="134" r="8" fill="#1a0800" style={{ transformOrigin: "158px 134px", animation: "ns-blink 5s 0.15s ease-in-out infinite" }} />
            {/* Eye shine */}
            <circle cx="116" cy="129" r="3.5" fill="white" opacity="0.95" />
            <circle cx="162" cy="129" r="3.5" fill="white" opacity="0.95" />
            <circle cx="109" cy="137" r="1.5" fill="white" opacity="0.45" />
            <circle cx="155" cy="137" r="1.5" fill="white" opacity="0.45" />

            {/* Beak */}
            <path d="M125 154 L135 168 L145 154 Q135 150 125 154Z" fill="#f59e0b" />
            <path d="M125 154 L135 162 L145 154 Q135 152 125 154Z" fill="#fde68a" />
            {/* Smile lines */}
            <path d="M113 164 Q122 173 135 168" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
            <path d="M157 164 Q148 173 135 168" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />

            {/* WAND held at right side */}
            {/* Stick */}
            <rect x="180" y="198" width="8" height="72" rx="4" fill="#5c3d0f" transform="rotate(32 180 198)" />
            <rect x="182" y="198" width="5" height="72" rx="2.5" fill="#7d5520" transform="rotate(32 182 198)" />
            {/* Wand tip star */}
            <g transform="translate(207 170) rotate(15)">
              <polygon points="0,-16 4,-6 15,-6 6,2 9,13 0,6 -9,13 -6,2 -15,-6 -4,-6" fill="#fbbf24" filter="url(#glow)" />
              <polygon points="0,-11 2.8,-4 9.5,-4 4.5,1 6.5,9 0,4.5 -6.5,9 -4.5,1 -9.5,-4 -2.8,-4" fill="#fffbeb" />
              <circle cx="0" cy="-1" r="20" fill="rgba(251,191,36,.12)" />
              <circle cx="0" cy="-1" r="11" fill="rgba(251,191,36,.22)" />
            </g>
            {/* Trailing sparkles from wand */}
            <circle cx="226" cy="148" r="3.5" fill="#fbbf24" opacity="0.9" filter="url(#glow)" />
            <circle cx="238" cy="138" r="2.5" fill="#c4b5fd" opacity="0.85" />
            <circle cx="232" cy="162" r="3" fill="#fbbf24" opacity="0.75" />
            <circle cx="246" cy="152" r="2" fill="white" opacity="0.9" />
            <circle cx="220" cy="140" r="2" fill="#c4b5fd" opacity="0.65" />
            <circle cx="242" cy="165" r="1.5" fill="#fde68a" opacity="0.7" />

            {/* Talons */}
            <path d="M112 255 Q106 268 100 276 M112 255 Q113 270 111 278 M112 255 Q120 268 124 276"
              stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M158 255 Q152 268 146 276 M158 255 Q159 270 157 278 M158 255 Q166 268 170 276"
              stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </svg>
          </div>

          {/* Orbiting wand sparkles */}
          {SPARKLE_ANGLES.map((angle, i) => (
            <WandSparkle key={angle} angle={angle} delay={i * 0.3} />
          ))}
        </div>

        {/* Title & tagline */}
        <div className="flex flex-col items-center gap-2 mt-1" style={{ animation: "ns-fadein 0.9s 0.4s ease both" }}>
          <h1 className="text-5xl font-bold" style={{
            background: "linear-gradient(90deg, #fbbf24, #c4b5fd, #67e8f9, #fbbf24)",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "ns-shimmer 4s ease-in-out infinite",
            fontFamily: "var(--font-outfit), sans-serif",
            letterSpacing: "-0.02em",
          }}>
            NightStory
          </h1>
          <p className="text-xs tracking-widest uppercase font-medium" style={{
            color: "rgba(196,181,253,0.6)",
            letterSpacing: "0.24em",
          }}>
            Magical bedtime stories
          </p>
        </div>

        {/* Animated loading dots */}
        <div className="flex gap-2 mt-10" style={{ animation: "ns-fadein 0.9s 0.7s ease both" }}>
          {[0.4, 1, 0.4].map((opacity, i) => (
            <div key={i} className="rounded-full" style={{
              width: i === 1 ? 22 : 7,
              height: 7,
              background: `rgba(167,139,250,${opacity})`,
              boxShadow: i === 1 ? "0 0 12px rgba(167,139,250,0.6)" : undefined,
            }} />
          ))}
        </div>
      </div>
    </>
  );
}
