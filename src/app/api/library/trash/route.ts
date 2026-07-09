import { NextRequest, NextResponse } from "next/server";
import { getTrash, getTrashCount, emptyTrash } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  // ?count=1 — the Library page only needs the badge number, not every deleted
  // story's full script (which is what the trash rows carry). A head-count query
  // is one cheap round trip instead of a 100KB+ payload plus a purge pass.
  if (req.nextUrl.searchParams.get("count")) {
    return NextResponse.json({ count: await getTrashCount(ctx.familyId) });
  }
  return NextResponse.json(await getTrash(ctx.familyId));
}

export async function DELETE(req: NextRequest) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  await emptyTrash(ctx.familyId);
  return NextResponse.json({ ok: true });
}
