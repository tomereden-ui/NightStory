"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import type { ScriptBlock, Voice } from "@/types";
import type { Job } from "@/lib/jobs";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import Link from "next/link";

// ─── Script saves browser ─────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ScriptBrowser({
  onLoad,
  refreshKey,
}: {
  onLoad: (save: ScriptSaveFull) => void;
  refreshKey: number;
}) {
  const [saves, setSaves] = useState<ScriptSaveMeta[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/script-saves", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSaves(d); })
      .catch(() => {});
  }, [refreshKey]);

  if (saves.length === 0) return null;

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/script-saves/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Not found");
      const save = await res.json() as ScriptSaveFull;
      onLoad(save);
      setExpanded(false);
    } catch {
      // keep expanded
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`/api/script-saves/${id}`, { method: "DELETE" });
      setSaves((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="mb-5 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg, rgba(10,18,40,0.95) 0%, rgba(5,8,20,0.98) 100%)",
        border: "1px solid rgba(79,195,247,0.18)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(79,195,247,0.06) inset",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex items-center justify-center w-6 h-6 rounded-lg text-sm"
            style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.2)" }}
          >
            📂
          </span>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(79,195,247,0.75)", letterSpacing: "0.08em" }}>
            Saved Versions
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums"
            style={{
              background: "linear-gradient(135deg, rgba(79,195,247,0.2), rgba(79,195,247,0.08))",
              color: "#4fc3f7",
              border: "1px solid rgba(79,195,247,0.25)",
            }}
          >
            {saves.length}
          </span>
        </div>
        <span
          className="text-white/40 text-xs transition-transform duration-200"
          style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* Filmstrip */}
      {expanded && (
        <>
          <div
            className="h-px mx-4"
            style={{ background: "linear-gradient(90deg, transparent, rgba(79,195,247,0.15), transparent)" }}
          />
          <div
            className="flex gap-3 px-4 py-4"
            style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            {saves.map((s) => {
              const isLoading  = loadingId === s.id;
              const isDeleting = deletingId === s.id;
              return (
                <div key={s.id} className="relative flex-shrink-0" style={{ width: 120 }}>
                  <button
                    onClick={() => handleLoad(s.id)}
                    disabled={isLoading}
                    className="w-full flex flex-col rounded-xl overflow-hidden text-left transition-all active:scale-[0.96]"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: s.isAutosave
                        ? "1px solid rgba(79,195,247,0.35)"
                        : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: s.isAutosave
                        ? "0 0 16px rgba(79,195,247,0.1)"
                        : "0 2px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    {/* Cover art */}
                    <div
                      className="relative w-full flex items-center justify-center overflow-hidden"
                      style={{ height: 90, background: "linear-gradient(135deg, rgba(20,30,60,1) 0%, rgba(10,15,35,1) 100%)" }}
                    >
                      {s.coverUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl opacity-30">🌙</span>
                      )}
                      {/* Gradient overlay at bottom */}
                      <div
                        className="absolute inset-x-0 bottom-0 h-8"
                        style={{ background: "linear-gradient(to top, rgba(5,8,20,0.8), transparent)" }}
                      />
                      {/* Autosave badge */}
                      {s.isAutosave && (
                        <span
                          className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(79,195,247,0.25)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.4)" }}
                        >
                          AUTO
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-0.5 px-2.5 py-2">
                      <span
                        className="text-[10px] font-bold truncate"
                        style={{ color: s.isAutosave ? "#4fc3f7" : "rgba(255,255,255,0.75)" }}
                      >
                        {isLoading ? "Loading…" : s.label}
                      </span>
                      <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {s.blockCount} lines · {timeAgo(s.savedAt)}
                      </span>
                    </div>
                  </button>

                  {/* Delete button — floats top-right */}
                  {!s.isAutosave && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id, e); }}
                      disabled={isDeleting}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all"
                      style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      {isDeleting ? "…" : "×"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}



interface CastMember {
  characterName: string;
  voice: Voice | undefined;
}

function CharacterCards({
  blocks,
  voicePool,
  avatars,
  onDirectCharacter,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  onDirectCharacter: (characterName: string, instruction: string) => void;
}) {
  const cast = Array.from(
    blocks
      .filter((b) => b.characterName !== "SFX")
      .reduce<Map<string, CastMember>>((map, b) => {
        if (!map.has(b.characterName)) {
          map.set(b.characterName, {
            characterName: b.characterName,
            voice: voicePool.find((v) => v.id === b.assignedVoiceId),
          });
        }
        return map;
      }, new Map())
      .values(),
  );

  if (cast.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.45)" }}>
        Cast — tap to direct a character
      </p>
      <div className="flex gap-3 pb-2 -mx-5 px-5" style={{ overflowX: "scroll", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {cast.map(({ characterName, voice }) => (
          <CharacterCard
            key={characterName}
            characterName={characterName}
            voice={voice}
            avatarUrl={avatars[characterName]}
            onDirect={(instruction) => onDirectCharacter(characterName, instruction)}
          />
        ))}
      </div>
    </div>
  );
}

const CHAR_CHIPS = [
  "More gentle",
  "More dramatic",
  "More playful",
  "Shorter lines",
  "More expressive",
];

function CharacterCard({
  characterName,
  voice,
  avatarUrl,
  onDirect,
}: {
  characterName: string;
  voice: Voice | undefined;
  avatarUrl?: string;
  onDirect: (instruction: string) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [note, setNote]       = useState("");
  const cardRef               = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const isNarrator            = characterName === "Narrator";

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 60);
    const close = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const submit = (instruction: string) => {
    if (!instruction.trim()) return;
    onDirect(`For the character "${characterName}": ${instruction.trim()}`);
    setNote("");
    setOpen(false);
  };

  const initial = characterName.charAt(0).toUpperCase();

  return (
    <div ref={cardRef} className="relative flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: 68 }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex flex-col items-center gap-1.5 w-full group"
        title={`Direct ${characterName}`}
      >
        <div
          className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-bold transition-all relative"
          style={open
            ? { border: "2px solid rgba(139,92,246,0.55)", boxShadow: "0 0 14px rgba(139,92,246,0.25)" }
            : { border: "1px solid rgba(255,255,255,0.1)" }
          }
        >
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt={characterName} className="w-full h-full object-cover" />
          ) : voice?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={voice.avatarUrl} alt={voice.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", color: isNarrator ? "rgba(167,139,250,0.8)" : "rgba(79,195,247,0.8)" }}
            >
              {initial}
            </div>
          )}
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight truncate w-full"
          style={{ color: isNarrator ? "rgba(167,139,250,0.7)" : "rgba(79,195,247,0.7)" }}
        >
          {characterName}
        </span>
        {voice && (
          <span className="text-[9px] text-white/25 text-center truncate w-full">{voice.name.split(" ")[0]}</span>
        )}
      </button>

      {/* Direction popup */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 rounded-2xl p-3 flex flex-col gap-2.5"
          style={{ background: "#0d1120", border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 8px 32px rgba(0,0,0,0.7)", width: 220 }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>
            Direct {characterName}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CHAR_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => submit(chip)}
                className="text-[10px] px-2 py-1 rounded-full transition-all active:scale-95"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)", color: "#C4B5FD" }}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(note); if (e.key === "Escape") setOpen(false); }}
              placeholder={`e.g. "speak slower"`}
              className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] outline-none text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.22)" }}
            />
            <button
              onClick={() => submit(note)}
              disabled={!note.trim()}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95"
              style={note.trim()
                ? { background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#A78BFA" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }
              }
            >↵</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyStudio() {
  return (
    <div className="flex flex-col items-center py-20 text-center gap-5">
      <span className="text-6xl opacity-30">🎬</span>
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">No story in the studio yet</p>
        <p className="text-white/20 text-xs leading-relaxed">
          Generate a story in Create first,<br />then come here to direct and refine it.
        </p>
      </div>
      <Link
        href="/create"
        className="mt-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F" }}
      >
        ✨ Go to Create
      </Link>
    </div>
  );
}

// ─── Studio page ──────────────────────────────────────────────────────────────

type StudioView = "script" | "producing" | "drama";

export default function StudioPage() {
  const { isRTL } = useLanguage();

  const [scriptBlocks, setScriptBlocks]     = useState<ScriptBlock[]>([]);
  const [summary, setSummary]               = useState("");
  const [coverUrl, setCoverUrl]             = useState("");
  const [coverPrompt, setCoverPrompt]       = useState("");
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [voicePool, setVoicePool]           = useState<Voice[]>(PRESET_VOICE_POOL);
  const [loaded, setLoaded]                 = useState(false);

  const [view, setView]                     = useState<StudioView>("script");
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]     = useState<Job | null>(null);
  const [isProducing, setIsProducing]       = useState(false);
  const [produceError, setProduceError]     = useState<string | null>(null);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  const [directorNote, setDirectorNote]     = useState("");
  const [isRevising, setIsRevising]         = useState(false);
  const [reviseError, setReviseError]       = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>({});
  const avatarSeedingRef = useRef(false);

  const [pendingDirections, setPendingDirections] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savesRefreshKey, setSavesRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load voice pool
  useEffect(() => { fetchVoicePool().then(setVoicePool); }, []);

  // Load draft on mount
  useEffect(() => {
    const draft = readDraft();
    if (draft?.scriptBlocks?.length) {
      setScriptBlocks(draft.scriptBlocks);
      setSummary(draft.summary ?? "");
      setCoverUrl(draft.coverUrl ?? "");
      setCoverPrompt(draft.coverPrompt ?? "");
      setEditingStoryId(draft.editingStoryId ?? null);
      setCharacterAvatars(draft.characterAvatars ?? {});
    }
    setLoaded(true);
  }, []);

  // Persist draft on change (including avatars)
  useEffect(() => {
    if (!loaded) return;
    writeDraft({ promptText: "", scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId: editingStoryId ?? undefined, characterAvatars });
  }, [scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId, characterAvatars, loaded]);

  // Auto-save to Supabase — debounced 3s after any script change
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      fetch("/api/script-saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: scriptBlocks, summary, coverUrl, coverPrompt, isAutosave: true }),
      })
        .then(() => setSavesRefreshKey((k) => k + 1))
        .catch(() => {});
    }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptBlocks, loaded]);

  // Background-seed missing character avatars one by one
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0 || avatarSeedingRef.current) return;
    const characters = Array.from(
      new Set(scriptBlocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName))
    );
    const missing = characters.filter((name) => !characterAvatars[name]);
    if (missing.length === 0) return;

    let cancelled = false;
    avatarSeedingRef.current = true;

    (async () => {
      for (const name of missing) {
        if (cancelled) break;
        try {
          const res = await fetch("/api/generate-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterName: name, summary }),
          });
          if (res.ok) {
            const { imageData, mimeType } = await res.json() as { imageData: string; mimeType: string };
            if (imageData && !cancelled) {
              const dataUrl = `data:${mimeType};base64,${imageData}`;
              setCharacterAvatars((prev) => ({ ...prev, [name]: dataUrl }));
            }
          }
        } catch {
          // ignore individual failures — letter initial stays shown
        }
      }
      avatarSeedingRef.current = false;
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scriptBlocks.length > 0]);

  const handleRevise = useCallback(async (instruction: string) => {
    if (!instruction.trim() || isRevising || scriptBlocks.length === 0) return;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: scriptBlocks, instruction: instruction.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      setScriptBlocks(data.blocks);
      setDirectorNote("");
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  }, [scriptBlocks, isRevising]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    if (scriptBlocks.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveLabel("saving");
    try {
      await fetch("/api/script-saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: scriptBlocks, summary, coverUrl, coverPrompt, isAutosave: false }),
      });
      setSavesRefreshKey((k) => k + 1);
      setSaveLabel("saved");
      setTimeout(() => setSaveLabel("idle"), 2500);
    } catch {
      setSaveLabel("idle");
    } finally {
      setIsSaving(false);
    }
  }, [scriptBlocks, summary, coverUrl, coverPrompt, isSaving]);

  // Load a save into the studio
  const handleLoadSave = useCallback((save: ScriptSaveFull) => {
    setScriptBlocks(save.blocks);
    if (save.summary)    setSummary(save.summary);
    if (save.coverUrl)   setCoverUrl(save.coverUrl);
    if (save.coverPrompt) setCoverPrompt(save.coverPrompt);
    setCharacterAvatars({});
    setPendingDirections([]);
  }, []);

  // Queue a character direction; shows toast to prompt "Update Script"
  const handleQueueDirection = useCallback((instruction: string) => {
    setPendingDirections((prev) => [...prev, instruction]);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 4500);
  }, []);

  // Apply all queued directions at once
  const handleUpdateScript = useCallback(async () => {
    if (pendingDirections.length === 0 || isRevising) return;
    const combined = pendingDirections.join(". Also: ");
    setPendingDirections([]);
    setShowToast(false);
    await handleRevise(combined);
  }, [pendingDirections, isRevising, handleRevise]);

  const fetchCover = useCallback(async (prompt: string, storySummary?: string) => {
    if (!prompt) return;
    setIsFetchingCover(true);
    try {
      const res  = await fetch("/api/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, summary: storySummary }) });
      const data = await res.json();
      if (res.ok && data.imageData) {
        setCoverUrl(`data:${data.mimeType ?? "image/jpeg"};base64,${data.imageData}`);
      }
    } finally {
      setIsFetchingCover(false);
    }
  }, []);

  const handleProduce = useCallback(async (blocks: ScriptBlock[], duration: number) => {
    setIsProducing(true);
    setProduceError(null);
    setView("producing");
    try {
      const body: Record<string, unknown> = { blocks, durationMinutes: duration };
      if (editingStoryId) body.editingStoryId = editingStoryId;
      if (summary) body.summary = summary;
      if (coverPrompt) body.coverPrompt = coverPrompt;
      const coverMatch = coverUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (coverMatch) { body.coverImageMimeType = coverMatch[1]; body.coverImageData = coverMatch[2]; }
      const res  = await fetch("/api/produce-drama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const text = await res.text();
      let data: { jobId?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data.error ?? "Production failed");
      setProductionJobId(data.jobId!);
    } catch (err: unknown) {
      setProduceError(err instanceof Error ? err.message : "Production failed");
      setIsProducing(false);
      setView("script");
    }
  }, [editingStoryId, summary, coverPrompt, coverUrl]);

  const handleProductionDone = useCallback((job: Job) => {
    setCompletedJob(job);
    setIsProducing(false);
    setView("drama");
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setProduceError(msg);
    setIsProducing(false);
    setProductionJobId(null);
    setView("script");
  }, []);

  // ─── Views ─────────────────────────────────────────────────────────────────

  if (!loaded) return null;

  if (view === "producing" && productionJobId) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setView("script"); setIsProducing(false); setProductionJobId(null); }}
              className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Producing…</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress jobId={productionJobId} onDone={handleProductionDone} onError={handleProductionError} coverUrl={coverUrl || undefined} />
        </div>
      </div>
    );
  }

  if (view === "drama" && completedJob) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => setView("script")} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Drama Ready</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={() => { setView("script"); setCompletedJob(null); }} />
        </div>
      </div>
    );
  }

  // ─── Main script view ───────────────────────────────────────────────────────

  return (
    <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          <a href="/create" className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</a>
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">🎬 Studio</h1>
          <div className="w-8" />
        </div>

        {/* Error */}
        {produceError && (
          <div className="mb-4 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {produceError}
          </div>
        )}

        {scriptBlocks.length === 0 ? (
          <EmptyStudio />
        ) : (
          <>
            {/* Script version browser */}
            <ScriptBrowser onLoad={handleLoadSave} refreshKey={savesRefreshKey} />

            {/* Script blocks — CharacterCards injected between cover and blocks via belowCover */}
            <ScriptTab
              blocks={scriptBlocks}
              voices={voicePool}
              onBlocksChange={setScriptBlocks}
              onProduce={handleProduce}
              isProducing={isProducing}
              summary={summary}
              coverUrl={coverUrl}
              isFetchingCover={isFetchingCover}
              onRegenerateCover={coverPrompt ? () => { setCoverUrl(""); fetchCover(coverPrompt, summary); } : undefined}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
              hideDirectorsNote
              hideDurationPicker
              hideProduceButton
              studioMode
              belowCover={
                <CharacterCards
                  blocks={scriptBlocks}
                  voicePool={voicePool}
                  avatars={characterAvatars}
                  onDirectCharacter={(_, instruction) => handleQueueDirection(instruction)}
                />
              }
            />

            {/* ── Director's Note — below the script, after the user has read it ── */}
            <div
              className="mt-2 mb-3 rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.22)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎬</span>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.8)" }}>
                  Director&apos;s Note
                </span>
                {isRevising && (
                  <span className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(167,139,250,0.65)" }}>
                    <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(139,92,246,0.3)", borderTopColor: "#A78BFA" }} />
                    Revising story…
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "😴 More sleepy",   instruction: "Make the whole story more sleepy and calming — softer language, slower pace, perfect for drifting off" },
                  { label: "✨ More magical",  instruction: "Add more magic, wonder and enchantment throughout" },
                  { label: "😂 Funnier",       instruction: "Add playful humor and lightness throughout — make it fun and giggly for young children" },
                  { label: "✂️ Shorter",       instruction: "Shorten the story — condense each scene to its essential moment while keeping the emotional arc" },
                  { label: "💫 More dramatic", instruction: "Add more dramatic tension and emotional peaks" },
                  { label: "🌙 Cozier",        instruction: "Make the story feel warmer, cozier and more comforting — like being tucked in on a cold night" },
                ].map(({ label, instruction }) => (
                  <button
                    key={label}
                    disabled={isRevising}
                    onClick={() => handleRevise(instruction)}
                    className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
                    style={{
                      background: isRevising ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.28)",
                      color: isRevising ? "rgba(255,255,255,0.2)" : "#C4B5FD",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-end">
                <textarea
                  ref={noteRef}
                  value={directorNote}
                  onChange={(e) => setDirectorNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && directorNote.trim()) {
                      e.preventDefault();
                      handleRevise(directorNote);
                    }
                  }}
                  rows={2}
                  disabled={isRevising}
                  placeholder={'How should the whole story change? e.g. "make the ending happier", "add more tension in the middle"'}
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm leading-relaxed outline-none resize-none text-white/80 placeholder-white/20 transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.22)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.22)")}
                />
                <button
                  disabled={!directorNote.trim() || isRevising}
                  onClick={() => handleRevise(directorNote)}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all active:scale-95"
                  style={directorNote.trim() && !isRevising
                    ? { background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.55)", color: "#A78BFA" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }
                  }
                >↵</button>
              </div>

              {reviseError && (
                <p className="text-[10px]" style={{ color: "rgba(239,68,68,0.75)" }}>⚠ {reviseError}</p>
              )}
            </div>

            {/* Update Script — active when character directions are queued */}
            <button
              onClick={handleUpdateScript}
              disabled={pendingDirections.length === 0 || isRevising}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2.5"
              style={pendingDirections.length > 0 && !isRevising
                ? { background: "rgba(139,92,246,0.18)", border: "1.5px solid rgba(139,92,246,0.55)", color: "#C4B5FD", boxShadow: "0 0 20px rgba(139,92,246,0.15)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.2)" }
              }
            >
              {isRevising ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(139,92,246,0.3)", borderTopColor: "#A78BFA" }} />
                  Updating…
                </>
              ) : pendingDirections.length > 0 ? (
                <>✏️ Update Script · {pendingDirections.length} direction{pendingDirections.length > 1 ? "s" : ""}</>
              ) : (
                <>✏️ Update Script</>
              )}
            </button>

            {/* Produce Audio — pinned after Director's Note */}
            <button
              onClick={() => handleProduce(scriptBlocks, durationMinutes)}
              disabled={isProducing}
              className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
                !isProducing ? "btn-vivid" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
              }`}
            >
              {isProducing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse-slow">🎙️</span>Mixing audio tracks…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">🎙️ Produce Audio</span>
              )}
            </button>

            {/* Save script version */}
            <button
              onClick={handleManualSave}
              disabled={isSaving || saveLabel === "saved"}
              className="w-full mt-2.5 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={saveLabel === "saved"
                ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
              }
            >
              {saveLabel === "saving" ? (
                <><span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.5)" }} />Saving…</>
              ) : saveLabel === "saved" ? (
                <>✓ Script saved</>
              ) : (
                <>💾 Save script version</>
              )}
            </button>

            {/* Toast — appears after queuing a character direction */}
            <div
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none"
              style={{
                opacity: showToast ? 1 : 0,
                transform: showToast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(8px)",
              }}
            >
              <div
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap"
                style={{ background: "rgba(139,92,246,0.92)", color: "#fff", boxShadow: "0 4px 20px rgba(139,92,246,0.45)", backdropFilter: "blur(8px)" }}
              >
                ✏️ Tap &quot;Update Script&quot; to apply your direction
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
