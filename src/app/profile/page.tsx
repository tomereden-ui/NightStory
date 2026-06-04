"use client";

import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

const TIER_COLORS: Record<string, string> = {
  free: "text-white/40",
  basic: "text-blue-400",
  premium: "text-gold",
  family: "text-purple-400",
};

const TIER_EMOJI: Record<string, string> = {
  free: "🌱",
  basic: "⭐",
  premium: "👑",
  family: "🏡",
};

export default function ProfilePage() {
  const { t, language, isRTL } = useLanguage();
  const user = MOCK_USER;

  return (
    <div className="relative min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={25} />

      <div className="relative px-5 pt-12 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">{t("profile")}</h1>
          <LanguageToggle />
        </div>

        {/* Avatar & name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-navy-lighter border-2 border-gold/30 flex items-center justify-center text-4xl mb-3 shadow-gold-sm">
            {user.avatarEmoji}
          </div>
          <h2 className="text-white text-xl font-bold">{user.displayName}</h2>
          <p className="text-white/40 text-sm mt-0.5">{user.email}</p>

          {/* Subscription badge */}
          <div
            className={`flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-full bg-navy-lighter border border-white/10 ${TIER_COLORS[user.subscriptionTier]}`}
          >
            <span>{TIER_EMOJI[user.subscriptionTier]}</span>
            <span className="text-xs font-semibold capitalize">
              {language === "he"
                ? user.subscriptionTier === "premium"
                  ? "פרימיום"
                  : user.subscriptionTier
                : user.subscriptionTier}
            </span>
          </div>
        </div>

        {/* Child profiles */}
        <div className="mb-6">
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">
            {language === "he" ? "פרופילי ילדים" : "Child Profiles"}
          </h3>
          <div className="flex gap-3">
            {user.childProfiles.map((child) => (
              <div
                key={child.id}
                className="flex-1 card-base p-3 flex flex-col items-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-navy-lighter border border-white/10 flex items-center justify-center text-xl">
                  {child.avatarEmoji}
                </div>
                <span className="text-white text-sm font-medium">{child.name}</span>
                <span className="text-white/30 text-[10px] bg-navy-lighter px-2 py-0.5 rounded-full">
                  {child.ageGroup} {language === "he" ? "שנים" : "yrs"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">
            {language === "he" ? "סטטיסטיקות" : "Stats"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                value: user.favoriteStoryIds.length,
                label: language === "he" ? "מועדפים" : "Favorites",
                emoji: "♥",
              },
              {
                value: user.recentlyPlayedIds.length,
                label: language === "he" ? "הושמעו" : "Played",
                emoji: "🎵",
              },
              {
                value: user.childProfiles.length,
                label: language === "he" ? "ילדים" : "Children",
                emoji: "👶",
              },
            ].map((stat) => (
              <div key={stat.label} className="card-base p-3 text-center">
                <p className="text-xl mb-1">{stat.emoji}</p>
                <p className="text-gold font-bold text-lg leading-none">{stat.value}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settings list */}
        <div>
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">
            {language === "he" ? "הגדרות" : "Settings"}
          </h3>
          <div className="flex flex-col gap-1">
            {[
              {
                icon: "🔔",
                label: language === "he" ? "התראות" : "Notifications",
                value: language === "he" ? "פעיל" : "On",
              },
              {
                icon: "🌙",
                label: language === "he" ? "מצב לילה" : "Night Mode",
                value: language === "he" ? "תמיד" : "Always",
              },
              {
                icon: "🔊",
                label: language === "he" ? "עוצמת קול" : "Volume",
                value: "80%",
              },
            ].map((item) => (
              <button
                key={item.label}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-navy-card border border-white/5 hover:border-gold/20 transition-colors text-left w-full"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1 text-white/70 text-sm">{item.label}</span>
                <span className="text-white/30 text-xs">{item.value}</span>
                <span className="text-white/20 text-xs">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
