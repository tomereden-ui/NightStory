"use client";

import OwlAvatar from "@/components/ui/OwlAvatar";

// Full-size takeover card for a moment with nothing else on screen yet
// (e.g. generating a brand-new story, or validating one right after).
// `steps`/`currentStep` render a dot progress trail under the label when
// the caller can say which step is active; omit them for a single-phase
// wait with just the label.
export function LunaWorkingHero({ label, subtitle, steps, currentStep }: {
  label: string;
  subtitle?: string;
  steps?: string[];
  currentStep?: number;
}) {
  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center"
      style={{
        minHeight: 200,
        background: "radial-gradient(ellipse at 50% 60%, rgba(45,27,105,0.9) 0%, rgba(10,20,60,0.95) 55%, rgba(6,9,20,1) 100%)",
        border: "1px solid rgba(139,92,246,0.2)",
      }}
    >
      {/* Glow halos */}
      <div className="absolute w-48 h-48 rounded-full animate-pulse pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(79,195,247,0.12) 0%, transparent 70%)", animationDuration: "2.4s" }} />
      <div className="absolute w-32 h-32 rounded-full animate-pulse pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 70%)", animationDuration: "1.8s", animationDelay: "0.6s" }} />

      <div className="relative mb-5">
        <OwlAvatar size={64} />
      </div>

      <p className="text-fs-body font-bold text-white/80 tracking-wide transition-all duration-500">{label}</p>
      {subtitle && (
        <p className="text-fs-body mt-1.5" style={{ color: "rgba(139,92,246,0.75)" }}>{subtitle}</p>
      )}

      {steps && steps.length > 0 && (
        <div className="flex gap-1.5 mt-4 items-center">
          {steps.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-500"
              style={{ width: i === currentStep ? 20 : 6, height: 6, background: i <= (currentStep ?? -1) ? "#4fc3f7" : "rgba(79,195,247,0.2)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Compact inline banner for a wait that happens alongside content already
// on screen (e.g. rewriting an existing script — the prior text is still
// visible, no reason to hide it behind a full takeover).
export function LunaWorkingBanner({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-3"
      style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(79,195,247,0.05))", border: "1px solid rgba(139,92,246,0.25)" }}
    >
      <OwlAvatar size={36} />
      <span className="text-fs-body font-semibold" style={{ color: "rgba(196,181,253,0.85)" }}>{label}</span>
    </div>
  );
}
