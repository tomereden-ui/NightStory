import type { SupabaseClient } from "@supabase/supabase-js";

// Per-run stage timing for the production pipeline. Stages are recorded as
// millisecond offsets from the run's start rather than absolute times, so
// overlap between concurrent stages (planning vs dialogue TTS, dialogue vs
// SFX) is directly visible in the stored row: two stages whose ranges
// intersect ran in parallel.
export interface StageSpan {
  startMs: number;
  endMs?: number;
  ms?: number;
}

export class ProductionTimer {
  private readonly t0 = Date.now();
  private readonly stages: Record<string, StageSpan> = {};

  start(stage: string): void {
    if (this.stages[stage]) return; // first start wins
    this.stages[stage] = { startMs: Date.now() - this.t0 };
  }

  end(stage: string): void {
    const span = this.stages[stage];
    if (!span || span.endMs !== undefined) return;
    span.endMs = Date.now() - this.t0;
    span.ms = span.endMs - span.startMs;
  }

  /** Run a stage around an existing promise without changing its behavior. */
  track<T>(stage: string, promise: Promise<T>): Promise<T> {
    this.start(stage);
    // .finally on both paths; errors still propagate to the caller untouched.
    return promise.finally(() => this.end(stage));
  }

  totalMs(): number {
    return Date.now() - this.t0;
  }

  summaryLine(): string {
    const parts = Object.entries(this.stages)
      .sort(([, a], [, b]) => a.startMs - b.startMs)
      .map(([name, s]) => `${name}=${((s.ms ?? (Date.now() - this.t0 - s.startMs)) / 1000).toFixed(1)}s@${(s.startMs / 1000).toFixed(1)}s`);
    return `total=${(this.totalMs() / 1000).toFixed(1)}s | ${parts.join(" | ")}`;
  }

  /**
   * Persist the run to public.production_metrics. Never throws — a missing
   * table (migration not run yet) or transient DB error must not affect a
   * finished production; it just logs a warning.
   *
   * markScriptDone (below) already inserted a 'script_done' row for this
   * story_id the moment the script itself was saved, well before audio
   * production even started — this updates that same row in place with the
   * audio-stage metrics and the final outcome, rather than leaving a stale
   * "script done, audio never happened" row sitting next to a separate one.
   * Falls back to a fresh insert when no such row exists (older stories from
   * before this existed, or any flow that bypasses POST /api/library).
   */
  async flush(
    supabase: SupabaseClient,
    meta: {
      storyId: string;
      jobId: string;
      storyTitle?: string;
      language?: string;
      dialogueCount?: number;
      sfxCount?: number;
      cacheDialogueHits?: number;
      cacheSfxHits?: number;
      skippedLines?: number;
      // final produced audio's length — undefined on an error outcome, since
      // no audio was ever produced
      durationSeconds?: number;
      outcome: "done" | "error";
      errorMessage?: string;
    },
  ): Promise<void> {
    // markScriptDone (below) already recorded a "script_generation" span in
    // stages when the script itself was written — a plain overwrite here
    // would erase it the moment audio production finishes. Read whatever's
    // already there first and layer this run's own stages on top, so the
    // full script → audio timeline survives in one row.
    let existingStages: Record<string, StageSpan> = {};
    try {
      const { data: existingRow } = await supabase
        .from("production_metrics")
        .select("stages")
        .eq("story_id", meta.storyId)
        .eq("outcome", "script_done")
        .maybeSingle();
      existingStages = (existingRow?.stages as Record<string, StageSpan> | undefined) ?? {};
    } catch (err) {
      console.warn("[perfMetrics] flush: reading existing stages failed, proceeding without them:", err);
    }

    const payload = {
      job_id: meta.jobId,
      story_title: meta.storyTitle ?? null,
      language: meta.language ?? null,
      dialogue_count: meta.dialogueCount ?? null,
      sfx_count: meta.sfxCount ?? null,
      cache_dialogue_hits: meta.cacheDialogueHits ?? null,
      cache_sfx_hits: meta.cacheSfxHits ?? null,
      skipped_lines: meta.skippedLines ?? null,
      duration_seconds: meta.durationSeconds ?? null,
      outcome: meta.outcome,
      error_message: meta.errorMessage ?? null,
      total_ms: this.totalMs(),
      stages: { ...existingStages, ...this.stages },
    };

    try {
      const { data: updated, error: updateError } = await supabase
        .from("production_metrics")
        .update(payload)
        .eq("story_id", meta.storyId)
        .eq("outcome", "script_done")
        .select("id");

      if (updateError) {
        console.warn("[perfMetrics] update failed:", updateError.message);
      } else if (updated && updated.length > 0) {
        return;
      } else {
        // No matching 'script_done' row for this story_id — either a
        // pre-existing story from before markScriptDone existed, or (worth
        // investigating if this shows up) the two phases disagreed on
        // story_id and this insert is about to orphan an earlier row.
        console.warn(`[perfMetrics] no script_done row found for story_id=${meta.storyId}; inserting a fresh row instead of updating`);
      }

      const { error } = await supabase.from("production_metrics").insert({ story_id: meta.storyId, ...payload });
      if (error) console.warn("[perfMetrics] insert failed:", error.message);
    } catch (err) {
      console.warn("[perfMetrics] flush failed:", err);
    }
  }
}

/**
 * Marks the "script done, audio not yet produced" stage — call this the
 * moment a freshly generated script is first persisted (POST /api/library,
 * long before Produce Audio ever runs, and it may never run at all). Records
 * whatever's known at that point; ProductionTimer.flush later finds this row
 * by story_id and fills in the rest once/if audio production finishes.
 * Never throws — same rationale as ProductionTimer.flush.
 */
export async function markScriptDone(
  supabase: SupabaseClient,
  meta: {
    storyId: string;
    storyTitle?: string;
    language?: string;
    dialogueCount?: number;
    sfxCount?: number;
    // How long the raw Gemini generation step alone took (the generate-story/
    // five-question-story retry loop), measured server-side and threaded
    // through the client to here — undefined for admin-pasted scripts, which
    // never call a generation endpoint at all.
    scriptGenerationMs?: number;
  },
): Promise<void> {
  try {
    const row = {
      story_id: meta.storyId,
      story_title: meta.storyTitle ?? null,
      language: meta.language ?? null,
      dialogue_count: meta.dialogueCount ?? null,
      sfx_count: meta.sfxCount ?? null,
      script_generation_ms: meta.scriptGenerationMs ?? null,
      outcome: "script_done",
      total_ms: 0,
      // Recorded as a proper stage span (not just the flat column above) so
      // it sits in the same timeline ProductionTimer's later audio-pipeline
      // stages land in — flush() merges into this rather than overwriting it.
      stages: meta.scriptGenerationMs !== undefined
        ? { script_generation: { startMs: 0, endMs: meta.scriptGenerationMs, ms: meta.scriptGenerationMs } }
        : {},
    };
    const { error } = await supabase.from("production_metrics").insert(row);
    if (error) {
      // Until production-metrics-generation-migration.sql has been run, the
      // script_generation_ms column doesn't exist — and one unknown column
      // fails the ENTIRE insert, meaning no script_done row at all, which
      // then breaks everything downstream that finds-and-updates this row
      // (ProductionTimer.flush, recordScriptRevision's phase_N entries).
      // Degrade for real: retry without the new column. The duration isn't
      // fully lost either — it still rides along inside stages (a column
      // that has existed since the base migration).
      if (/script_generation_ms/.test(error.message)) {
        const { script_generation_ms: _dropped, ...withoutNewColumn } = row;
        const { error: retryError } = await supabase.from("production_metrics").insert(withoutNewColumn);
        if (retryError) console.warn("[perfMetrics] markScriptDone retry insert failed:", retryError.message);
        else console.warn("[perfMetrics] markScriptDone: script_generation_ms column missing (migration not run yet) — row saved without it");
      } else {
        console.warn("[perfMetrics] markScriptDone insert failed:", error.message);
      }
    }
  } catch (err) {
    console.warn("[perfMetrics] markScriptDone failed:", err);
  }
}

/** One pre-production script edit (Director's Note or lesson rewrite) — the
 *  shape stored under stages.phase_N. Unlike StageSpan (an offset from a
 *  shared run start), these have no shared timer to offset from — revisions
 *  can land minutes or hours apart — so each one carries its own real
 *  timestamp instead. */
export interface RevisionPhaseSpan {
  ms: number;
  type: "directors_note" | "lesson_rewrite";
  instruction?: string;
  at: string;
}

/**
 * Records one pre-production script revision (Director's Note or lesson
 * rewrite, both applied via /api/revise-script) as a numbered phase —
 * phase_1, phase_2, ... — in the same production_metrics row markScriptDone
 * created, plus a running revision_count alongside them. Matches the most
 * recently created row for this story_id (there should only ever be one, but
 * "most recent" is a safer tiebreaker than an arbitrary one if that ever
 * isn't true) and merges into its existing stages rather than overwriting —
 * same rationale as ProductionTimer.flush. Best-effort: if no row exists yet
 * (a revision landing before the initial script-done save has resolved is a
 * real, if narrow, race), logs a warning and skips rather than inserting a
 * partial row missing every field markScriptDone would normally set.
 */
export async function recordScriptRevision(
  supabase: SupabaseClient,
  meta: { storyId: string; type: "directors_note" | "lesson_rewrite"; ms: number; instruction?: string },
): Promise<void> {
  try {
    const { data: existingRow, error: selectError } = await supabase
      .from("production_metrics")
      .select("id, stages")
      .eq("story_id", meta.storyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.warn("[perfMetrics] recordScriptRevision: select failed:", selectError.message);
      return;
    }
    if (!existingRow) {
      console.warn(`[perfMetrics] recordScriptRevision: no production_metrics row found for story_id=${meta.storyId}, skipping`);
      return;
    }

    const stages = (existingRow.stages as Record<string, unknown> | null) ?? {};
    const nextPhase = Object.keys(stages).filter((k) => /^phase_\d+$/.test(k)).length + 1;
    const phaseEntry: RevisionPhaseSpan = {
      ms: meta.ms,
      type: meta.type,
      at: new Date().toISOString(),
      ...(meta.instruction ? { instruction: meta.instruction.slice(0, 300) } : {}),
    };

    const { error: updateError } = await supabase
      .from("production_metrics")
      .update({ stages: { ...stages, [`phase_${nextPhase}`]: phaseEntry, revision_count: nextPhase } })
      .eq("id", existingRow.id);
    if (updateError) console.warn("[perfMetrics] recordScriptRevision: update failed:", updateError.message);
  } catch (err) {
    console.warn("[perfMetrics] recordScriptRevision failed:", err);
  }
}
