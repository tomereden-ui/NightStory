"use client";

// Luna's animated owl avatar — a conic-gradient ring around a gently
// floating owl image. Originally built for LunaChatPanel's chat bubbles;
// extracted here so any "the system is working" moment across the app can
// reuse the same branded visual instead of a generic spinner.
export default function OwlAvatar({ size = 44 }: { size?: number }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <style>{`
        @keyframes _lunaRing { 0%,100%{opacity:0.7;transform:scale(1) rotate(0deg);}50%{opacity:1;transform:scale(1.06) rotate(180deg);} }
        @keyframes _lunaFloat { 0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);} }
      `}</style>
      {/* animated gradient ring */}
      <div style={{
        position:"absolute", inset:-3, borderRadius:"50%",
        background:"conic-gradient(from 0deg,#a78bfa,#4fc3f7,#e879f9,#a78bfa)",
        animation:"_lunaRing 4s linear infinite",
        filter:"blur(1px)",
      }}/>
      <div style={{
        position:"absolute", inset:1.5, borderRadius:"50%",
        background:"#060912",
        overflow:"hidden",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/owl-avatar.png" alt="Luna" style={{ width:"100%", height:"100%", objectFit:"cover", animation:"_lunaFloat 4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}
