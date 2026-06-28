"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/lib/jobs";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  jobId: string;
  onDone: (job: Job) => void;
  onError: (msg: string) => void;
  coverUrl?: string;
}

const STEP_ICONS: Record<string, string> = {
  pending:   "⏳",
  planning:  "🗺️",
  recording: "🎙️",
  sfx:       "🔊",
  mixing:    "🎚️",
  done:      "✅",
  error:     "❌",
};

export default function ProductionProgress({ jobId, onDone, onError, coverUrl }: Props) {
  const { t } = useLanguage();
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
    { key: "planning",  label: t("stepPlanning"),  icon: "🗺️" },
    { key: "recording", label: t("stepRecording"), icon: "🎙️" },
    { key: "sfx",       label: t("stepSfx"),       icon: "🔊" },
    { key: "mixing",    label: t("stepMixing"),    icon: "🎚️" },
    { key: "done",      label: t("dramaReady"),    icon: "✅" },
  ];

  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div
      className="flex flex-col items-center justify-center px-6 text-center gap-6"
      style={{ minHeight: "60vh" }}
    >
      {/* Cover image or animated icon */}
      {coverUrl ? (
        <div className="relative w-full max-w-xs rounded-2xl overflow-hidden"
          style={{ aspectRatio: "16/9", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Story cover" className="w-full h-full object-cover" />
          {/* Animated overlay to show it's processing */}
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(5,8,20,0.45)", backdropFilter: "blur(1px)" }}>
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
              <div className="absolute inset-1 rounded-full opacity-40 animate-pulse"
                style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
              <span className="relative text-fs-display">{icon}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full animate-ping opacity-15"
            style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
          <div className="absolute inset-2 rounded-full opacity-30 animate-pulse"
            style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
          <span className="relative text-5xl">{icon}</span>
        </div>
      )}

      {/* Current step */}
      <div>
        <p className="text-white font-semibold text-fs-heading mb-1">{step}</p>
        <p className="text-white/35 text-fs-body">{t("producingSubtitle")}</p>
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
            background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
          }}
        />
      </div>
      <p className="text-white/25 text-fs-body -mt-3">{progress}%</p>

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
                  ? "rgba(79,195,247,0.08)"
                  : isDone
                  ? "rgba(16,217,160,0.05)"
                  : "rgba(255,255,255,0.02)",
                border: isActive
                  ? "1px solid rgba(79,195,247,0.25)"
                  : isDone
                  ? "1px solid rgba(16,217,160,0.15)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span className="text-fs-heading w-7 flex-shrink-0">
                {isDone ? "✅" : isActive ? s.icon : "○"}
              </span>
              <span
                className="text-fs-body font-medium"
                style={{
                  color: isActive
                    ? "#4fc3f7"
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
                        background: "#4fc3f7",
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
