"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { TrashEntry } from "@/lib/libraryStore";
import { useLanguage } from "@/context/LanguageContext";
import Icon from "@/components/ui/Icon";

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function daysRemaining(deletedAt: number): number {
  return Math.max(0, Math.ceil((deletedAt + TRASH_TTL_MS - Date.now()) / 86_400_000));
}

export default function TrashPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyEmpty, setBusyEmpty] = useState(false);

  useEffect(() => {
    fetch("/api/library/trash")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRestore = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/library/trash/${id}`, { method: "POST" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silently ignore
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteForever = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/library/trash/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silently ignore
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyTrash = async () => {
    setBusyEmpty(true);
    try {
      await fetch("/api/library/trash", { method: "DELETE" });
      setEntries([]);
      setConfirmEmpty(false);
    } catch {
      // silently ignore
    } finally {
      setBusyEmpty(false);
    }
  };

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="flex items-center px-5 pt-12 pb-6">
        <Link href="/library" className="w-8 h-8 flex items-center justify-center text-white/40">
          <Icon name="back" size={18} />
        </Link>
        <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">{t("trash")}</h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pb-32">
        {/* Empty trash button */}
        {entries.length > 0 && (
          <div className="mb-5">
            {confirmEmpty ? (
              <div
                className="rounded-2xl px-4 py-4 flex flex-col gap-3"
                style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.3)" }}
              >
                <p className="text-fs-body text-white/70">
                  Permanently delete all {entries.length} {entries.length === 1 ? "story" : "stories"} in trash? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmEmpty(false)}
                    className="flex-1 py-2.5 rounded-xl text-fs-body transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleEmptyTrash}
                    disabled={busyEmpty}
                    className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all"
                    style={{
                      background: "rgba(236,72,153,0.18)",
                      border: "1px solid rgba(236,72,153,0.45)",
                      color: "#EC4899",
                    }}
                  >
                    {busyEmpty ? "…" : t("emptyTrash")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEmpty(true)}
                className="w-full py-3 rounded-2xl text-fs-body transition-all active:scale-[0.98]"
                style={{
                  background: "rgba(236,72,153,0.07)",
                  border: "1px solid rgba(236,72,153,0.25)",
                  color: "rgba(236,72,153,0.7)",
                }}
              >
                {t("emptyTrash")}
              </button>
            )}
          </div>
        )}

        {/* Info blurb */}
        {entries.length > 0 && (
          <p className="text-fs-body text-center mb-5" style={{ color: "rgba(255,255,255,0.25)" }}>
            {t("keptFor30Days")}
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center pt-24">
            <span className="text-white/30 text-fs-body animate-pulse">Loading…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-4 text-center">
            <span className="text-5xl opacity-30">🗑</span>
            <p className="text-white/30 text-fs-body font-light">{t("trashEmpty")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => {
              const days = daysRemaining(entry.deletedAt);
              const isBusy = busyId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl overflow-hidden transition-opacity"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    opacity: isBusy ? 0.4 : 1,
                  }}
                >
                  {/* Story row */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Cover */}
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-fs-subtitle"
                      style={{
                        background: entry.coverUrl
                          ? undefined
                          : "radial-gradient(ellipse at 40% 40%, rgba(26,58,110,0.6), rgba(45,27,78,0.6))",
                        border: "1px solid rgba(255,255,255,0.08)",
                        filter: "grayscale(0.4) opacity(0.7)",
                      }}
                    >
                      {entry.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover" />
                      ) : (
                        <span>🌙</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/60 text-fs-body font-medium truncate leading-snug">
                        {entry.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-fs-body px-1.5 py-0.5 rounded-full font-semibold"
                          style={
                            days <= 3
                              ? { background: "rgba(236,72,153,0.12)", color: "#EC4899", border: "1px solid rgba(236,72,153,0.3)" }
                              : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }
                          }
                        >
                          {days === 0 ? "Deletes today" : `${days}d left`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div
                    className="flex border-t"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <button
                      onClick={() => handleRestore(entry.id)}
                      disabled={isBusy}
                      className="flex-1 py-2.5 text-fs-body font-medium transition-all active:opacity-60"
                      style={{ color: "rgba(79,195,247,0.7)" }}
                    >
                      <Icon name="restore" size={14} className="inline-block align-middle mr-1" /> {t("restore")}
                    </button>
                    <div style={{ width: "1px", background: "rgba(255,255,255,0.06)" }} />
                    <button
                      onClick={() => handleDeleteForever(entry.id)}
                      disabled={isBusy}
                      className="flex-1 py-2.5 text-fs-body font-medium transition-all active:opacity-60"
                      style={{ color: "rgba(236,72,153,0.6)" }}
                    >
                      {t("deleteForever")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
