import { NextRequest, NextResponse } from "next/server";
import { restoreFromTrash, deleteFromTrashForever } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ok = await restoreFromTrash(params.id);
  if (!ok) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ok = await deleteFromTrashForever(params.id);
  if (!ok) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
