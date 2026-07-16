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
      stages: this.stages,
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
  meta: { storyId: string; storyTitle?: string; language?: string; dialogueCount?: number; sfxCount?: number },
): Promise<void> {
  try {
    const { error } = await supabase.from("production_metrics").insert({
      story_id: meta.storyId,
      story_title: meta.storyTitle ?? null,
      language: meta.language ?? null,
      dialogue_count: meta.dialogueCount ?? null,
      sfx_count: meta.sfxCount ?? null,
      outcome: "script_done",
      total_ms: 0,
    });
    if (error) console.warn("[perfMetrics] markScriptDone insert failed:", error.message);
  } catch (err) {
    console.warn("[perfMetrics] markScriptDone failed:", err);
  }
}
