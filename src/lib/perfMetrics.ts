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
      outcome: "done" | "error";
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      const { error } = await supabase.from("production_metrics").insert({
        story_id: meta.storyId,
        job_id: meta.jobId,
        story_title: meta.storyTitle ?? null,
        language: meta.language ?? null,
        dialogue_count: meta.dialogueCount ?? null,
        sfx_count: meta.sfxCount ?? null,
        cache_dialogue_hits: meta.cacheDialogueHits ?? null,
        cache_sfx_hits: meta.cacheSfxHits ?? null,
        skipped_lines: meta.skippedLines ?? null,
        outcome: meta.outcome,
        error_message: meta.errorMessage ?? null,
        total_ms: this.totalMs(),
        stages: this.stages,
      });
      if (error) console.warn("[perfMetrics] insert failed:", error.message);
    } catch (err) {
      console.warn("[perfMetrics] flush failed:", err);
    }
  }
}
