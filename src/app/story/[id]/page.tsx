import type { Metadata } from "next";
import { headers } from "next/headers";
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

// Falls back to this when a story has no cover yet (e.g. never produced),
// so the link preview is still a real branded image instead of blank —
// same artwork used on the login/onboarding screens and this page's own
// promo card, for a consistent first impression.
const FALLBACK_OG_IMAGE = "/splash-family.png";

export async function generateMetadata(
  { params }: { params: { id: string } },
): Promise<Metadata> {
  const story = await fetchStoryMeta(params.id);
  if (!story) return { title: "NightStory" };

  const description = story.summary ?? "A personalised bedtime story";
  // Story covers are generated square (no forced aspect ratio on the
  // Gemini image call) — the old 1200x630 hint lied about the shape and
  // could make link-preview surfaces squish/crop the image. Omitting
  // width/height lets WhatsApp/iMessage/etc. measure the real file
  // instead of trusting a wrong number.
  // Crawlers (unlike browsers) can't resolve a relative image path, so
  // the fallback needs an absolute URL — built from the actual request
  // host rather than a hardcoded domain, same pattern as the OAuth
  // callback route.
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const ogImage = story.cover_url ?? `${origin}${FALLBACK_OG_IMAGE}`;

  return {
    title: story.title,
    description,
    openGraph: {
      title: story.title,
      description,
      images: [{ url: ogImage }],
      type: "website",
      siteName: "NightStory",
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description,
      images: [ogImage],
    },
  };
}

export default function SharePage({ params }: { params: { id: string } }) {
  return <SharePageClient storyId={params.id} />;
}
