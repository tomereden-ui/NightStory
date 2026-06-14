import { NextResponse } from "next/server";
import { getTrash, emptyTrash } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getTrash());
}

export async function DELETE() {
  await emptyTrash();
  return NextResponse.json({ ok: true });
}
