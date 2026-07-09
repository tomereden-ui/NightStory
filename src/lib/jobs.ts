import type { LibraryEntry } from "./libraryStore";

export type JobStatus =
  | "pending"
  | "planning"
  | "recording"
  | "sfx"
  | "mixing"
  | "done"
  | "error";

export interface Job {
  id: string;
  status: JobStatus;
  step: string;
  progress: number; // 0–100
  title?: string;
  storyId?: string;
  scriptJson?: object;
  audioUrl?: string;
  coverUrl?: string;
  durationSeconds?: number;
  voiceAssignments?: Record<string, string>;
  skippedLines?: string[];
  error?: string;
  libraryError?: string;
  createdAt: number;
  /** Populated when produce-drama is called with skipLibrarySave:true — used by /api/admin/save-story */
  pendingEntry?: LibraryEntry;
}

declare global {
  // eslint-disable-next-line no-var
  var __jobStore: Map<string, Job> | undefined;
  // eslint-disable-next-line no-var
  var __jobPersistChains: Map<string, Promise<void>> | undefined;
}

// In-memory cache: the fast path for reads on the instance running the
// production, a write-through source of truth for ordering, and the full
// fallback until the `jobs` table exists (pre-migration).
const store: Map<string, Job> =
  global.__jobStore ?? (global.__jobStore = new Map());

// Jobs are ALSO persisted to the `jobs` Supabase table so status polling
// works when the poll request lands on a different instance/lambda than the
// one running the production (in-memory state doesn't survive that split).
// Persistence is fire-and-forget and serialized per job so pipeline code
// never blocks on a DB write and updates can't land out of order.
const persistChains: Map<string, Promise<void>> =
  global.__jobPersistChains ?? (global.__jobPersistChains = new Map());

let jobsTableMissing = false;

function persist(job: Job): void {
  if (jobsTableMissing) return;
  const prev = persistChains.get(job.id) ?? Promise.resolve();
  const next = prev.then(async () => {
    try {
      const { supabase } = await import("./supabase");
      const { error } = await supabase.from("jobs").upsert({
        id: job.id,
        status: job.status,
        data: job,
        created_at: job.createdAt,
        updated_at: Date.now(),
      });
      if (error) {
        // Table not created yet (migration not run) — stop trying this process.
        if (/jobs|relation|schema/.test(error.message)) jobsTableMissing = true;
        else console.warn("[jobs] persist failed:", error.message);
      }
    } catch (e) {
      console.warn("[jobs] persist error:", e);
    }
  });
  persistChains.set(job.id, next);
}

// Progress ticks are frequent during TTS; only meaningful transitions are
// worth a DB write. Status/step changes and terminal fields always persist.
function isMeaningful(before: Job | undefined, after: Job): boolean {
  if (!before) return true;
  if (before.status !== after.status || before.step !== after.step) return true;
  if (after.error || after.audioUrl || after.pendingEntry) return true;
  return Math.abs(after.progress - before.progress) >= 5;
}

export function createJob(id: string): Job {
  const job: Job = {
    id,
    status: "pending",
    step: "Starting…",
    progress: 0,
    createdAt: Date.now(),
  };
  store.set(id, job);
  persist(job);
  return job;
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const j = store.get(id);
  if (!j) return;
  const updated = { ...j, ...patch };
  store.set(id, updated);
  if (isMeaningful(j, updated)) persist(updated);
}

export async function getJob(id: string): Promise<Job | undefined> {
  const local = store.get(id);
  if (local) return local;
  if (jobsTableMissing) return undefined;

  // Not on this instance — the production may be running elsewhere.
  try {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase.from("jobs").select("data").eq("id", id).maybeSingle();
    if (error) {
      if (/jobs|relation|schema/.test(error.message)) jobsTableMissing = true;
      return undefined;
    }
    return (data?.data as Job | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remove jobs older than 2 hours (memory now, DB best-effort). */
export function pruneJobs(): void {
  const cutoff = Date.now() - 7_200_000;
  Array.from(store.entries()).forEach(([id, j]) => {
    if (j.createdAt < cutoff) {
      store.delete(id);
      persistChains.delete(id);
    }
  });
  if (!jobsTableMissing) {
    import("./supabase")
      .then(({ supabase }) => supabase.from("jobs").delete().lt("created_at", cutoff))
      .then(({ error }) => {
        if (error && /jobs|relation|schema/.test(error.message)) jobsTableMissing = true;
      })
      .catch(() => {});
  }
}
