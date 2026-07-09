import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { addEntry } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json() as { jobId?: string };
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found — it may have expired (jobs live 2 h)" }, { status: 404 });
    if (!job.pendingEntry) return NextResponse.json({ error: "No pending entry for this job — story may already be saved or was produced without skipLibrarySave" }, { status: 409 });

    await addEntry(job.pendingEntry);
    return NextResponse.json({ ok: true, storyId: job.storyId ?? job.pendingEntry.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
