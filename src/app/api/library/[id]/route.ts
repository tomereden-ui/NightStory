import { NextRequest, NextResponse } from "next/server";
import { getEntry, moveToTrash } from "@/lib/libraryStore";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const entry = getEntry(params.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ok = moveToTrash(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
