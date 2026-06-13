import { NextResponse } from "next/server";
import { getTrash, emptyTrash } from "@/lib/libraryStore";

export async function GET() {
  return NextResponse.json(getTrash());
}

export async function DELETE() {
  emptyTrash();
  return NextResponse.json({ ok: true });
}
