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
  scriptJson?: object;
  audioUrl?: string;
  coverUrl?: string;
  voiceAssignments?: Record<string, string>;
  skippedLines?: string[];
  error?: string;
  libraryError?: string;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __jobStore: Map<string, Job> | undefined;
}

// Module-level singleton that survives Next.js hot-reloads in dev
const store: Map<string, Job> =
  global.__jobStore ?? (global.__jobStore = new Map());

export function createJob(id: string): Job {
  const job: Job = {
    id,
    status: "pending",
    step: "Starting…",
    progress: 0,
    createdAt: Date.now(),
  };
  store.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const j = store.get(id);
  if (j) store.set(id, { ...j, ...patch });
}

export function getJob(id: string): Job | undefined {
  return store.get(id);
}

/** Remove jobs older than 2 hours */
export function pruneJobs(): void {
  const cutoff = Date.now() - 7_200_000;
  Array.from(store.entries()).forEach(([id, j]) => {
    if (j.createdAt < cutoff) store.delete(id);
  });
}
