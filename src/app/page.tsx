"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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

const STARS = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  x: +((((i * 137.508) % 100)).toFixed(1)),
  y: +((((i * 94.27) % 100)).toFixed(1)),
  size: 1 + (i % 3),
  delay: +((i % 30) / 10).toFixed(1),
  duration: 2 + (i % 4),
}));


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

        {/* OWL — Imagen-generated Pixar portrait */}
        <div style={{
          width: 300, height: 300,
          animation: "ns-float 5s ease-in-out infinite, ns-fadein 0.9s 0.2s ease both",
          filter: "drop-shadow(0 0 40px rgba(167,139,250,0.5)) drop-shadow(0 0 80px rgba(251,191,36,0.25))",
        }}>
          <Image
            src="/owl-splash.png"
            alt="NightStory owl wizard"
            width={300}
            height={300}
            priority
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
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
