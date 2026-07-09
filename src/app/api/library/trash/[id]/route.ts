import { NextRequest, NextResponse } from "next/server";
import { restoreFromTrash, deleteFromTrashForever } from "@/lib/libraryStore";
import { getFamilyContext } from "@/lib/authContext";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  const ok = await restoreFromTrash(params.id, ctx.familyId);
  if (!ok) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getFamilyContext(req);
  if (!ctx) return NextResponse.json({ error: "No family" }, { status: 403 });
  const ok = await deleteFromTrashForever(params.id, ctx.familyId);
  if (!ok) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
