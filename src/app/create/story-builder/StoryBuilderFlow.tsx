"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import Icon from "@/components/ui/Icon";
import {
  HERO_PRESETS, COMPANION_PRESETS, SETTING_PRESETS, MISSION_PRESETS,
  getStoryBuilderUi, getHeroLabels, getCompanionLabels, getSettingLabels, getMissionLabels,
} from "@/constants/storyBuilderUi";
import { MOODS as STORY_MOODS, MOOD_ACCENT, getStoryMoodLabels } from "@/constants/moodUi";
import type { IconName } from "@/lib/icons";
import { IllustratedCard } from "@/app/create/five-question/FiveQuestionFlow";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import { pickRandom } from "@/constants/surprisePicks";
import type { ScriptBlock } from "@/types";
import type { Job } from "@/lib/jobs";

// Hero/Companion/Setting/Mission presets carry a plain emoji (used as the
// IllustratedCard loading-skeleton glyph, and as the fallback if a photo
// hasn't been generated yet); Mood presets (from moodUi.ts) carry an
// abstract line icon instead (deliberately, per this session's earlier
// "no emoji" mood work, shared with Library's mood filter) — PresetStep
// below renders whichever one a given entry has, and only fetches photos
// for the emoji-based steps.
type AnyPreset = { id: string } & ({ emoji: string; icon?: never } | { icon: IconName; emoji?: never });

// Matches the corresponding CreateOptionType in config/createFlowImages.ts —
// kept as a plain string union here (rather than importing the type) since
// only these 4 story-builder-specific values are ever used on this page.
type ImageCategory = "sbHero" | "sbCompanion" | "sbSetting" | "sbMission";

type Step = "hero" | "companion" | "setting" | "mission" | "mood" | "summary" | "review" | "producing" | "done";

interface FieldChoice { type: string; customText?: string }

interface BuilderState {
  hero: FieldChoice;
  companion: FieldChoice;
  setting: FieldChoice;
  mission: string;
  mood: string;
}

const INITIAL_STATE: BuilderState = {
  hero: { type: "" },
  companion: { type: "" },
  setting: { type: "" },
  mission: "",
  mood: "",
};

const STEP_ORDER: Step[] = ["hero", "companion", "setting", "mission", "mood", "summary", "review"];

type ValidationField = "heroName" | "companionName" | "world";

async function validateCustomText(text: string, field: ValidationField, language: string): Promise<{ approved: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/validate-wizard-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, field, language }),
    });
    if (!res.ok) return { approved: true };
    return await res.json();
  } catch {
    return { approved: true };
  }
}

// ─── Shared shell for every preset-picker step ──────────────────────────────

function StepShell({ headline, onBack, children }: { headline: string; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-8">
        {onBack
          ? <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ background: "rgba(255,255,255,0.06)" }}><Icon name="back" size={16} /></button>
          : <div className="w-8" />}
        <div className="flex-1" />
        <div className="w-8" />
      </div>
      <h1 className="text-fs-title font-semibold text-white mb-7 leading-snug">{headline}</h1>
      {children}
    </div>
  );
}

// ─── Generic single-select preset grid, with an optional "My Own X" custom option ──

interface PresetStepProps {
  headline: string;
  presets: AnyPreset[];
  labels: Record<string, string>;
  selected: FieldChoice | string;
  onSelect: (choice: FieldChoice | string) => void;
  onConfirm: () => void;
  onBack?: () => void;
  accent: string;
  ui: ReturnType<typeof getStoryBuilderUi>;
  // Custom-text option — omitted entirely for Mission/Mood (closed lists, per spec)
  custom?: { label: string; placeholder: string; field: ValidationField };
  effectiveLanguage: string;
  // When set, presets render as photo-illustrated IllustratedCards (matching
  // the main SBS wizard) instead of a plain emoji/icon tile — omitted for
  // Mood, which keeps the app-wide abstract-icon treatment.
  imageType?: ImageCategory;
  optionImages?: Record<string, string>;
}

function PresetStep({ headline, presets, labels, selected, onSelect, onConfirm, onBack, accent, ui, custom, effectiveLanguage, imageType, optionImages }: PresetStepProps) {
  const selectedType = typeof selected === "string" ? selected : selected.type;
  const [showCustomInput, setShowCustomInput] = useState(selectedType === "custom");
  const [customText, setCustomText] = useState(typeof selected === "object" ? selected.customText ?? "" : "");
  const [checking, setChecking] = useState(false);
  const [customError, setCustomError] = useState("");

  const isSelectionValid = custom
    ? (selectedType && selectedType !== "custom") || (selectedType === "custom" && !!customText.trim())
    : !!selectedType;

  const submitCustom = async () => {
    const trimmed = customText.trim();
    if (!trimmed || !custom) return;
    setChecking(true);
    setCustomError("");
    const result = await validateCustomText(trimmed, custom.field, effectiveLanguage);
    setChecking(false);
    if (!result.approved) {
      setCustomError(result.reason || ui.pleaseRephrase);
      return;
    }
    onSelect({ type: "custom", customText: trimmed });
  };

  return (
    <StepShell headline={headline} onBack={onBack}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          {presets.map((p) => {
            const active = selectedType === p.id;
            const label = labels[p.id] ?? p.id;

            if (imageType) return (
              <IllustratedCard
                key={p.id}
                label={label}
                emoji={p.emoji ?? ""}
                imageUrl={optionImages?.[`${imageType}-${p.id}`]}
                selected={active}
                onClick={() => { setShowCustomInput(false); onSelect(typeof selected === "string" ? p.id : { type: p.id }); }}
              />
            );

            return (
              <button
                key={p.id}
                onClick={() => { setShowCustomInput(false); onSelect(typeof selected === "string" ? p.id : { type: p.id }); }}
                className="flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-[0.97]"
                style={active
                  ? { background: `${accent}1f`, border: `1px solid ${accent}70` }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {p.icon
                  ? <Icon name={p.icon} size={32} style={{ color: active ? accent : "rgba(255,255,255,0.7)" }} />
                  : <span className="text-fs-display">{p.emoji}</span>}
                <span className="text-fs-body font-semibold" style={{ color: active ? accent : "rgba(255,255,255,0.85)" }}>
                  {label}
                </span>
              </button>
            );
          })}

          {custom && (
            <button
              onClick={() => { setShowCustomInput(true); if (typeof selected !== "string") onSelect({ type: "custom", customText }); }}
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl transition-all active:scale-[0.97] col-span-2"
              style={selectedType === "custom"
                ? { background: `${accent}1f`, border: `1px solid ${accent}70` }
                : { background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.2)" }}
            >
              <span className="text-fs-body font-semibold" style={{ color: selectedType === "custom" ? accent : "rgba(255,255,255,0.7)" }}>
                ➕ {custom.label}
              </span>
            </button>
          )}
        </div>

        {custom && showCustomInput && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={customText}
              maxLength={50}
              onChange={(e) => { setCustomText(e.target.value); setCustomError(""); }}
              placeholder={custom.placeholder}
              className="w-full px-4 py-3 rounded-xl text-fs-body text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
            {customError && <p className="text-fs-body" style={{ color: "#f87171" }}>{customError}</p>}
            <button
              onClick={submitCustom}
              disabled={!customText.trim() || checking}
              className="py-2.5 rounded-xl font-semibold text-fs-body transition-all active:scale-[0.98]"
              style={customText.trim() && !checking
                ? { background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
            >
              {checking ? ui.checkingAnswer : "✓"}
            </button>
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={!isSelectionValid}
          className="mt-2 py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
          style={isSelectionValid
            ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
        >
          {ui.continueButton}
        </button>
      </div>
    </StepShell>
  );
}

// ─── Summary screen — recap every selection, with an edit link back to each step ──

function SummaryView({ state, ui, heroLabels, companionLabels, settingLabels, missionLabels, moodLabels, onEditStep, onConfirm, onBack }: {
  state: BuilderState; ui: ReturnType<typeof getStoryBuilderUi>;
  heroLabels: Record<string, string>; companionLabels: Record<string, string>;
  settingLabels: Record<string, string>; missionLabels: Record<string, string>; moodLabels: Record<string, string>;
  onEditStep: (step: Step) => void; onConfirm: () => void; onBack: () => void;
}) {
  const displayFor = (choice: FieldChoice, labels: Record<string, string>) =>
    choice.type === "custom" ? (choice.customText ?? "") : (labels[choice.type] ?? choice.type);

  const rows: { label: string; value: string; step: Step }[] = [
    { label: ui.heroHeadline, value: displayFor(state.hero, heroLabels), step: "hero" },
    { label: ui.companionHeadline, value: state.companion.type ? displayFor(state.companion, companionLabels) : "—", step: "companion" },
    { label: ui.settingHeadline, value: displayFor(state.setting, settingLabels), step: "setting" },
    { label: ui.missionHeadline, value: missionLabels[state.mission] ?? state.mission, step: "mission" },
    { label: ui.moodHeadline, value: moodLabels[state.mood] ?? state.mood, step: "mood" },
  ];

  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-7">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ background: "rgba(255,255,255,0.06)" }}><Icon name="back" size={16} /></button>
        <h1 className="flex-1 text-center text-fs-heading font-semibold text-white">{ui.allSet}</h1>
        <div className="w-8" />
      </div>

      <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {rows.map((row, i) => (
          <div key={row.step} className="flex items-center px-4 py-3 gap-3"
            style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.52)" }}>{row.label}</span>
              <span className="text-fs-body text-white/80 truncate">{row.value}</span>
            </div>
            <button onClick={() => onEditStep(row.step)}
              className="text-fs-body px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{ background: "rgba(79,195,247,0.08)", color: "rgba(79,195,247,0.7)", border: "1px solid rgba(79,195,247,0.2)" }}>
              {ui.edit}
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        className="mt-auto py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
        style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }}
      >
        {ui.createStory}
      </button>
    </div>
  );
}

// ─── Review screen ───────────────────────────────────────────────────────────

interface GeneratedStory {
  blocks: ScriptBlock[];
  title: string;
  summary: string;
  coverPrompt: string;
  characters: Record<string, { type: string; visualDescription: string }>;
  scenes?: unknown[];
}

function ReviewView({ state, effectiveLanguage, ui, onProduce, onBack, onError, existingStory }: {
  state: BuilderState; effectiveLanguage: string; ui: ReturnType<typeof getStoryBuilderUi>;
  onProduce: (story: GeneratedStory) => void; onBack: () => void; onError: (msg: string) => void;
  // If production failed and the parent routed back here, reuse the story
  // already generated instead of silently paying for a fresh Gemini
  // generation call just to redisplay the same review screen.
  existingStory?: GeneratedStory | null;
}) {
  const [story, setStory] = useState<GeneratedStory | null>(existingStory ?? null);
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(!existingStory);
  const [error, setError] = useState("");

  useState(() => {
    if (existingStory) return;
    (async () => {
      try {
        const res = await fetch("/api/story-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hero: state.hero, companion: state.companion, setting: state.setting,
            mission: state.mission, mood: state.mood,
            durationMinutes: 5, language: effectiveLanguage, narratorVoiceId: getNarratorVoiceId(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        setStory(data as GeneratedStory);
        if (data.coverPrompt) {
          fetch("/api/generate-cover", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: data.coverPrompt, summary: data.summary }),
          }).then((r) => r.json()).then((d) => { if (d.coverUrl) setCoverUrl(d.coverUrl); }).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        setError(msg);
        onError(msg);
      } finally {
        setLoading(false);
      }
    })();
  });

  if (loading) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-6">
        <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(79,195,247,0.5), transparent)" }} />
        <p className="text-white/70 text-fs-subtitle font-light">{ui.checkingAnswer}</p>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-4">
        <p className="text-fs-body" style={{ color: "#f87171" }}>⚠ {error}</p>
        <button onClick={onBack} className="px-4 py-2 rounded-xl text-fs-body font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }}>
          {ui.back}
        </button>
      </div>
    );
  }

  const castEntries = Object.entries(story.characters ?? {});

  return (
    <div className="flex flex-col min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-7">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ background: "rgba(255,255,255,0.06)" }}><Icon name="back" size={16} /></button>
        <h1 className="flex-1 text-center text-fs-heading font-semibold text-white truncate mx-2">{ui.reviewHeadline}</h1>
        <div className="w-8" />
      </div>

      {coverUrl && (
        <img src={coverUrl} alt={story.title} className="w-full aspect-square object-cover rounded-2xl mb-4" />
      )}

      <h2 className="text-fs-title font-bold text-white mb-2">{story.title}</h2>
      <p className="text-fs-body text-white/70 mb-5 leading-relaxed">{story.summary}</p>

      {castEntries.length > 0 && (
        <div className="mb-6">
          <p className="text-fs-label font-bold uppercase tracking-widest mb-2" style={{ color: MOOD_ACCENT }}>{ui.cast}</p>
          <div className="flex flex-wrap gap-1.5">
            {castEntries.map(([name, c]) => (
              <span key={name} className="px-3 py-1.5 rounded-full text-fs-body font-semibold" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
                {name} <span style={{ color: "rgba(255,255,255,0.4)" }}>· {c.type}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onProduce(story)}
        className="mt-auto py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]"
        style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }}
      >
        {ui.produceAudio}
      </button>
    </div>
  );
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

export function StoryBuilderFlow() {
  const router = useRouter();
  const { language } = useLanguage();
  const effectiveLanguage = language;
  const ui = useMemo(() => getStoryBuilderUi(effectiveLanguage), [effectiveLanguage]);
  const heroLabels = useMemo(() => getHeroLabels(effectiveLanguage), [effectiveLanguage]);
  const companionLabels = useMemo(() => getCompanionLabels(effectiveLanguage), [effectiveLanguage]);
  const settingLabels = useMemo(() => getSettingLabels(effectiveLanguage), [effectiveLanguage]);
  const missionLabels = useMemo(() => getMissionLabels(effectiveLanguage), [effectiveLanguage]);
  const moodLabels = useMemo(() => getStoryMoodLabels(effectiveLanguage), [effectiveLanguage]);

  const [step, setStep] = useState<Step>("hero");
  const [state, setState] = useState<BuilderState>(INITIAL_STATE);
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<Job | null>(null);
  // Set while editing a single field from the Summary screen — "Continue" on
  // that field should return straight to Summary instead of resuming the
  // normal Hero->Companion->Setting->Mission->Mood sequence.
  const [editingFromSummary, setEditingFromSummary] = useState(false);

  const [optionImages, setOptionImages] = useState<Record<string, string>>({});

  useState(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/seed-create-images");
        if (!res.ok) return;
        const { missing, existingImageUrls } = await res.json() as {
          missing: { key: string; prompt: string }[];
          existingImageUrls: Record<string, string>;
        };
        if (existingImageUrls) setOptionImages((prev) => ({ ...prev, ...existingImageUrls }));
        if (!missing?.length) return;
        // Only this flow's own sbHero/sbCompanion/sbSetting/sbMission keys —
        // the shared endpoint returns every option-image spec in the app
        // (main wizard's own hero/world/companion/etc too), and those are
        // seeded by that wizard itself; no need to duplicate the work here.
        const own = missing.filter((m) => m.key.startsWith("v5-sb"));
        const BATCH = 8;
        for (let i = 0; i < own.length; i += BATCH) {
          const batch = own.slice(i, i + BATCH);
          await Promise.all(batch.map(async ({ key, prompt }) => {
            try {
              const cacheRes = await fetch(`/api/admin/seed-create-images?key=${encodeURIComponent(key)}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }),
              });
              if (cacheRes.ok) {
                const { imageKey, url } = await cacheRes.json() as { imageKey: string; url: string };
                if (imageKey && url) setOptionImages((prev) => ({ ...prev, [imageKey]: url }));
              }
            } catch { /* best-effort */ }
          }));
        }
      } catch { /* best-effort — cards fall back to their emoji shimmer */ }
    })();
  });

  const nextOrSummary = useCallback((next: Step) => {
    if (editingFromSummary) { setEditingFromSummary(false); setStep("summary"); }
    else setStep(next);
  }, [editingFromSummary]);

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) nextOrSummary(STEP_ORDER[idx + 1]);
  }, [step, nextOrSummary]);

  const goBack = useCallback(() => {
    if (editingFromSummary) { setEditingFromSummary(false); setStep("summary"); return; }
    // Leaving Review backward means the user might change something on
    // Summary before confirming again — invalidate the cached generation so
    // a re-confirm regenerates against whatever they end up with, instead of
    // silently producing the stale story from before. (Returning to Review
    // from a failed *production* attempt is a different path — see
    // handleProduce's catch — and deliberately keeps the cached story.)
    if (step === "review") setStory(null);
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
    else router.back();
  }, [step, router, editingFromSummary]);

  const handleReset = useCallback(() => {
    setStep("hero");
    setState(INITIAL_STATE);
    setStory(null);
    setError(null);
    setProductionJobId(null);
    setCompletedJob(null);
    setEditingFromSummary(false);
  }, []);

  // "Surprise Me!" — random preset combination (never custom), straight to
  // the Summary recap (still reviewable/editable, same as the normal path).
  const handleSurpriseMe = useCallback(() => {
    setState({
      hero: { type: pickRandom(HERO_PRESETS).id },
      companion: { type: pickRandom(COMPANION_PRESETS).id },
      setting: { type: pickRandom(SETTING_PRESETS).id },
      mission: pickRandom(MISSION_PRESETS).id,
      mood: pickRandom(STORY_MOODS).id,
    });
    setStep("summary");
  }, []);

  const handleProduce = useCallback(async (generated: GeneratedStory) => {
    setStory(generated);
    setStep("producing");
    try {
      const res = await fetch("/api/produce-drama", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: generated.blocks, durationMinutes: 5, summary: generated.summary, coverPrompt: generated.coverPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Production failed");
      setProductionJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Production failed");
      setStep("review");
    }
  }, []);

  if (step === "hero") return (
    <>
      <PresetStep
        headline={ui.heroHeadline} presets={HERO_PRESETS} labels={heroLabels}
        selected={state.hero} onSelect={(c) => setState((s) => ({ ...s, hero: c as FieldChoice }))}
        onConfirm={goNext} onBack={editingFromSummary ? goBack : undefined} accent={MOOD_ACCENT} ui={ui} effectiveLanguage={effectiveLanguage}
        custom={{ label: ui.myOwnHero, placeholder: ui.heroPlaceholder, field: "heroName" }}
        imageType="sbHero" optionImages={optionImages}
      />
      {!editingFromSummary && (
        <div className="px-5 -mt-4 pb-4">
          <button onClick={handleSurpriseMe} className="w-full py-3 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            🎲 {ui.surpriseMe}
          </button>
        </div>
      )}
    </>
  );

  if (step === "companion") return (
    <PresetStep
      headline={ui.companionHeadline} presets={COMPANION_PRESETS} labels={companionLabels}
      selected={state.companion} onSelect={(c) => setState((s) => ({ ...s, companion: c as FieldChoice }))}
      onConfirm={goNext} onBack={goBack} accent={MOOD_ACCENT} ui={ui} effectiveLanguage={effectiveLanguage}
      custom={{ label: ui.myOwnCompanion, placeholder: ui.companionPlaceholder, field: "companionName" }}
      imageType="sbCompanion" optionImages={optionImages}
    />
  );

  if (step === "setting") return (
    <PresetStep
      headline={ui.settingHeadline} presets={SETTING_PRESETS} labels={settingLabels}
      selected={state.setting} onSelect={(c) => setState((s) => ({ ...s, setting: c as FieldChoice }))}
      onConfirm={goNext} onBack={goBack} accent={MOOD_ACCENT} ui={ui} effectiveLanguage={effectiveLanguage}
      custom={{ label: ui.myOwnPlace, placeholder: ui.settingPlaceholder, field: "world" }}
      imageType="sbSetting" optionImages={optionImages}
    />
  );

  if (step === "mission") return (
    <PresetStep
      headline={ui.missionHeadline} presets={MISSION_PRESETS} labels={missionLabels}
      selected={state.mission} onSelect={(id) => setState((s) => ({ ...s, mission: id as string }))}
      onConfirm={goNext} onBack={goBack} accent={MOOD_ACCENT} ui={ui} effectiveLanguage={effectiveLanguage}
      imageType="sbMission" optionImages={optionImages}
    />
  );

  if (step === "mood") return (
    <PresetStep
      headline={ui.moodHeadline} presets={STORY_MOODS} labels={moodLabels}
      selected={state.mood} onSelect={(id) => setState((s) => ({ ...s, mood: id as string }))}
      onConfirm={goNext} onBack={goBack} accent={MOOD_ACCENT} ui={ui} effectiveLanguage={effectiveLanguage}
    />
  );

  if (step === "summary") return (
    <SummaryView
      state={state} ui={ui}
      heroLabels={heroLabels} companionLabels={companionLabels} settingLabels={settingLabels}
      missionLabels={missionLabels} moodLabels={moodLabels}
      onEditStep={(s) => { setEditingFromSummary(true); setStep(s); }}
      onConfirm={() => setStep("review")}
      onBack={goBack}
    />
  );

  if (step === "review") return (
    <ReviewView
      state={state} effectiveLanguage={effectiveLanguage} ui={ui}
      onProduce={handleProduce} onBack={goBack} onError={setError}
      existingStory={story}
    />
  );

  if (step === "producing") {
    if (productionJobId) return (
      <div className="min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
        <div className="flex items-center mb-7">
          <div className="w-8" />
          <h1 className="flex-1 text-center text-fs-heading font-semibold text-white">{story?.title}</h1>
          <div className="w-8" />
        </div>
        <ProductionProgress
          jobId={productionJobId}
          onDone={(job) => { setCompletedJob(job); setStep("done"); }}
          onError={(msg) => { setError(msg); setStep("review"); }}
        />
      </div>
    );
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-8 text-center gap-6">
        <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(79,195,247,0.5), transparent)" }} />
        <p className="text-white/70 text-fs-subtitle font-light">{ui.produceAudio}…</p>
        {error && <p className="text-fs-body" style={{ color: "#f87171" }}>⚠ {error}</p>}
      </div>
    );
  }

  if (step === "done" && completedJob) return (
    <div className="min-h-full px-5 pt-12 pb-8" style={{ background: "transparent" }}>
      <div className="flex items-center mb-7">
        <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ background: "rgba(255,255,255,0.06)" }}><Icon name="back" size={16} /></button>
        <h1 className="flex-1 text-center text-fs-heading font-semibold text-white">{story?.title}</h1>
        <div className="w-8" />
      </div>
      <DramaPlayer job={completedJob} onGenerateAnother={handleReset} />
    </div>
  );

  return null;
}
