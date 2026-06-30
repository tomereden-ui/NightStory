import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import SharePageClient from "./SharePageClient";

export const dynamic = "force-dynamic";

async function fetchStoryMeta(id: string) {
  const { data } = await supabase
    .from("stories")
    .select("title, summary, cover_url")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const story = await fetchStoryMeta(params.id);
  if (!story) return { title: "NightStory" };
  return {
    title: story.title,
    description: story.summary ?? "A personalised bedtime story",
    openGraph: {
      title: story.title,
      description: story.summary ?? "A personalised bedtime story",
      images: story.cover_url ? [{ url: story.cover_url, width: 1200, height: 630 }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description: story.summary ?? "A personalised bedtime story",
      images: story.cover_url ? [story.cover_url] : [],
    },
  };
}

export default function SharePage({ params }: { params: { id: string } }) {
  return <SharePageClient storyId={params.id} />;
}
