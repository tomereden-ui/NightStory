"use client";

import { useState } from "react";
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
  const [exiting, setExiting] = useState(false);

  function handleGo() {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => router.replace("/library"), 500);
  }

  return (
    <>
      <style>{`
        @keyframes ns-twinkle {
          0%,100% { opacity:0; transform:scale(0.4); }
          50%      { opacity:0.9; transform:scale(1); }
        }
        @keyframes ns-float {
          0%,100% { transform:translateY(0) rotate(-2deg); }
          50%      { transform:translateY(-14px) rotate(2deg); }
        }
        @keyframes ns-shimmer {
          0%,100% { background-position:0% 50%; }
          50%      { background-position:100% 50%; }
        }
        @keyframes ns-moon {
          0%,100% { opacity:.7; transform:translateX(-50%) scale(1); }
          50%      { opacity:1; transform:translateX(-50%) scale(1.07); }
        }
        @keyframes ns-fadein {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes ns-btn-glow {
          0%,100% { box-shadow: 0 0 24px 4px rgba(251,191,36,0.45), 0 0 60px 8px rgba(167,139,250,0.25); }
          50%      { box-shadow: 0 0 40px 8px rgba(251,191,36,0.75), 0 0 90px 16px rgba(167,139,250,0.45); }
        }
        @keyframes ns-stars-in {
          from { opacity:0; letter-spacing:0.5em; }
          to   { opacity:1; letter-spacing:0.18em; }
        }
        .ns-go-btn:active { transform: scale(0.96) !important; }
      `}</style>

      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-between overflow-hidden select-none"
        style={{
          background: "radial-gradient(ellipse 110% 85% at 50% 28%, #1e1268 0%, #0c0628 45%, #050210 100%)",
          opacity: exiting ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* OWL — full screen background */}
        <div className="absolute inset-0">
          <Image
            src="/owl-splash.png"
            alt="NightStory owl wizard"
            fill
            priority
            style={{ objectFit: "contain", objectPosition: "center 55%" }}
          />
          {/* Top gradient so logo is readable */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, rgba(5,2,16,0.72) 0%, rgba(5,2,16,0.3) 20%, rgba(5,2,16,0.0) 45%, rgba(5,2,16,0.0) 60%, rgba(5,2,16,0.75) 80%, rgba(5,2,16,0.97) 100%)",
          }} />
        </div>

        {/* Logo — top */}
        <div className="relative flex flex-col items-center gap-1 pt-14" style={{ animation: "ns-fadein 0.9s 0.2s ease both" }}>
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
          <p className="text-xs font-medium" style={{
            color: "rgba(196,181,253,0.65)",
            letterSpacing: "0.24em",
            animation: "ns-stars-in 1.2s 0.5s ease both",
          }}>
            ✦ MAGICAL BEDTIME STORIES ✦
          </p>
        </div>

        {/* CTA Button — bottom */}
        <div className="relative flex justify-center pb-16">
        <button
          className="ns-go-btn"
          onClick={handleGo}
          style={{
            padding: "16px 48px",
            borderRadius: 999,
            border: "1.5px solid rgba(251,191,36,0.55)",
            background: "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(167,139,250,0.18) 100%)",
            backdropFilter: "blur(12px)",
            color: "#fff",
            fontSize: "1.15rem",
            fontWeight: 700,
            fontFamily: "var(--font-outfit), sans-serif",
            letterSpacing: "0.04em",
            cursor: "pointer",
            animation: "ns-fadein 0.9s 1s ease both, ns-btn-glow 3s 1.9s ease-in-out infinite",
            transition: "transform 0.15s ease, background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "linear-gradient(135deg, rgba(251,191,36,0.32) 0%, rgba(167,139,250,0.32) 100%)";
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(167,139,250,0.18) 100%)";
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          Let&apos;s go ✨
        </button>
        </div>
      </div>
    </>
  );
}
