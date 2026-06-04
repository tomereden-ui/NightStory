"use client";

import { useLanguage } from "@/context/LanguageContext";
import SectionHeader from "@/components/ui/SectionHeader";
import StoryCard from "@/components/ui/StoryCard";
import { getFeaturedStories } from "@/lib/mockData";

export default function FeaturedSection() {
  const { t } = useLanguage();
  const stories = getFeaturedStories();

  return (
    <section className="mb-6">
      <SectionHeader
        title={t("featuredStories")}
        action={{ label: "See all", href: "/library" }}
      />
      <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-1">
        {stories.map((story) => (
          <div key={story.id} className="flex-shrink-0">
            <StoryCard story={story} variant="featured" />
          </div>
        ))}
      </div>
    </section>
  );
}
