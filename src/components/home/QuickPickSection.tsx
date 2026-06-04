"use client";

import { useLanguage } from "@/context/LanguageContext";
import SectionHeader from "@/components/ui/SectionHeader";
import StoryCard from "@/components/ui/StoryCard";
import { STORIES } from "@/lib/mockData";

const CATEGORIES = ["bedtime", "fantasy", "adventure"] as const;

export default function QuickPickSection() {
  const { t, language } = useLanguage();

  const bedtimeStories = STORIES.filter((s) => s.category === "bedtime").slice(0, 3);

  return (
    <section className="mb-6">
      <SectionHeader
        title={t("forYou")}
        action={{ label: language === "he" ? "הכל" : "See all", href: "/library" }}
      />
      <div className="flex flex-col gap-2 px-5">
        {bedtimeStories.map((story) => (
          <StoryCard key={story.id} story={story} variant="list" />
        ))}
      </div>
    </section>
  );
}
