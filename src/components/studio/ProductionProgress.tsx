"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/lib/jobs";

interface Props {
  jobId: string;
  onDone: (job: Job) => void;
  onError: (msg: string) => void;
}

const STEP_ICONS: Record<string, string> = {
  pending:   "⏳",
  planning:  "✍️",
  recording: "🎙️",
  sfx:       "🔊",
  mixing:    "🎚️",
  done:      "✅",
  error:     "❌",
};

export default function ProductionProgress({ jobId, onDone, onError }: Props) {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/drama-status/${jobId}`);
          if (!res.ok) break;
          const data: Job = await res.json();
          setJob(data);

          if (data.status === "done") {
            onDone(data);
            return;
          }
          if (data.status === "error") {
            onError(data.error ?? "Production failed");
            return;
          }
        } catch {
          // network hiccup — keep polling
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [jobId, onDone, onError]);

  const status = job?.status ?? "pending";
  const icon = STEP_ICONS[status] ?? "⏳";
  const step = job?.step ?? "Starting…";
  const progress = job?.progress ?? 0;

  const STEPS = [
    { key: "planning",  label: "Writing script",        icon: "✍️" },
    { key: "recording", label: "Recording voices",       icon: "🎙️" },
    { key: "sfx",       label: "Generating SFX",         icon: "🔊" },
    { key: "mixing",    label: "Mixing audio",            icon: "🎚️" },
    { key: "done",      label: "Drama ready",             icon: "✅" },
  ];

  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div
      className="flex flex-col items-center justify-center px-6 text-center gap-6"
      style={{ minHeight: "60vh" }}
    >
      {/* Animated icon */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-15"
          style={{ background: "radial-gradient(circle,#00D4FF,#0088AA)" }}
        />
        <div
          className="absolute inset-2 rounded-full opacity-30 animate-pulse"
          style={{ background: "radial-gradient(circle,#00D4FF,#0088AA)" }}
        />
        <span className="relative text-5xl">{icon}</span>
      </div>

      {/* Current step */}
      <div>
        <p className="text-white font-semibold text-base mb-1">{step}</p>
        <p className="text-white/35 text-xs">Your audio drama is being produced…</p>
      </div>

      {/* Progress bar */}
      <div
        className="w-56 h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg,#00D4FF,#00A8C8)",
          }}
        />
      </div>
      <p className="text-white/25 text-xs -mt-3">{progress}%</p>

      {/* Step tracker */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {STEPS.map((s, idx) => {
          const isDone = idx < currentIdx || status === "done";
          const isActive = s.key === status;
          return (
            <div
              key={s.key}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{
                background: isActive
                  ? "rgba(0,212,255,0.08)"
                  : isDone
                  ? "rgba(16,217,160,0.05)"
                  : "rgba(255,255,255,0.02)",
                border: isActive
                  ? "1px solid rgba(0,212,255,0.25)"
                  : isDone
                  ? "1px solid rgba(16,217,160,0.15)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span className="text-lg w-7 flex-shrink-0">
                {isDone ? "✅" : isActive ? s.icon : "○"}
              </span>
              <span
                className="text-xs font-medium"
                style={{
                  color: isActive
                    ? "#00D4FF"
                    : isDone
                    ? "#10D9A0"
                    : "rgba(255,255,255,0.25)",
                }}
              >
                {s.label}
              </span>
              {isActive && (
                <div className="ml-auto flex gap-0.5 items-end h-3">
                  {[1, 2, 3].map((j) => (
                    <span
                      key={j}
                      className="w-0.5 rounded-full"
                      style={{
                        background: "#00D4FF",
                        height: `${6 + j * 3}px`,
                        animation: `bounce 0.5s ease-in-out ${j * 0.1}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
