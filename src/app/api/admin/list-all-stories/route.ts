import { NextResponse } from "next/server";
import { getEntries, getPublicEntries } from "@/lib/libraryStore";

export const dynamic = "force-dynamic";

export interface AdminStoryOption {
  id: string;
  title: string;
  createdAt: number;
  coverUrl?: string;
  seriesId?: string;
  chapterNumber?: number;
  chapterCount?: number;
}

// Every story in the DB, private and public alike — used to populate the
// "Add Episode to Series" pickers in /admin, which (unlike user-facing
// routes) needs to see every family's stories, not just one family's.
export async function GET() {
  const [priv, pub] = await Promise.all([getEntries(), getPublicEntries()]);
  const all = [...priv, ...pub]
    .filter((e) => !e.isDraft)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((e): AdminStoryOption => ({
      id: e.id,
      title: e.title,
      createdAt: e.createdAt,
      coverUrl: e.coverUrl,
      seriesId: e.seriesId,
      chapterNumber: e.chapterNumber,
      chapterCount: e.chapterCount,
    }));
  return NextResponse.json(all);
}
