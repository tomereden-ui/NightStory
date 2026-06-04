"use client";

import { useLanguage } from "@/context/LanguageContext";
import SectionHeader from "@/components/ui/SectionHeader";
import StoryCard from "@/components/ui/StoryCard";
import { getRecentStories, MOCK_USER } from "@/lib/mockData";

export default function RecentSection() {
  const { t } = useLanguage();
  const recent = getRecentStories(MOCK_USER.recentlyPlayedIds.slice(0, 4));

  if (recent.length === 0) return null;

  return (
    <section className="mb-5">
      <SectionHeader title={t("recentlyPlayed")} />
      <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-1">
        {recent.map((story) => (
          <StoryCard key={story.id} story={story} variant="compact" />
        ))}
      </div>
    </section>
  );
}
