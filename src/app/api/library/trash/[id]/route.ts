import { NextRequest, NextResponse } from "next/server";
import { restoreFromTrash, deleteFromTrashForever } from "@/lib/libraryStore";

// POST /api/library/trash/[id] → restore
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ok = restoreFromTrash(params.id);
  if (!ok) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/library/trash/[id] → delete forever
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ok = deleteFromTrashForever(params.id);
  if (!ok) return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
