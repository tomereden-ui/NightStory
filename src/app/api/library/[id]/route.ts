import { NextRequest, NextResponse } from "next/server";
import { getEntry, moveToTrash } from "@/lib/libraryStore";
import { supabase } from "@/lib/supabase";
import type { ScriptBlock } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const entry = await getEntry(params.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  let body: { blocks?: ScriptBlock[]; title?: string; summary?: string; childId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.blocks   !== undefined) updates.blocks   = body.blocks;
  if (body.title    !== undefined) updates.title    = body.title;
  if (body.summary  !== undefined) updates.summary  = body.summary;
  if (body.childId  !== undefined) updates.child_id = body.childId ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("stories").update(updates).eq("id", id);
  if (error) {
    console.error("[library PATCH] db error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ok = await moveToTrash(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
