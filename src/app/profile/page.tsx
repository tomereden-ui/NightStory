"use client";

import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

const TIER_BADGE: Record<string, { label: string; color: string; emoji: string }> = {
  free:    { label: "Free",    color: "text-white/40 border-white/10",   emoji: "🌱" },
  basic:   { label: "Basic",   color: "text-teal border-teal/30",        emoji: "⭐" },
  premium: { label: "Premium", color: "text-purple-bright border-purple/40", emoji: "👑" },
  family:  { label: "Family",  color: "text-pink border-pink/30",        emoji: "🏡" },
};

export default function ProfilePage() {
  const { t, language, isRTL } = useLanguage();
  const user = MOCK_USER;
  const tier = TIER_BADGE[user.subscriptionTier] ?? TIER_BADGE.free;

  return (
    <div className="relative min-h-full bg-bg" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={25} />

      <div className="relative px-5 pt-12 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-bold text-white">{t("profile")}</h1>
          <LanguageToggle />
        </div>

        {/* Avatar & name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-bg-elevated border-2 border-purple/30 flex items-center justify-center text-4xl mb-3 shadow-purple-sm">
            {user.avatarEmoji}
          </div>
          <h2 className="text-white text-xl font-bold">{user.displayName}</h2>
          <p className="text-white/35 text-sm mt-0.5">{user.email}</p>

          {/* Subscription badge */}
          <div className={`flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-full bg-bg-elevated border ${tier.color}`}>
            <span>{tier.emoji}</span>
            <span className="text-xs font-semibold capitalize">
              {language === "he"
                ? user.subscriptionTier === "premium" ? "פרימיום" : user.subscriptionTier
                : tier.label}
            </span>
          </div>
        </div>

        {/* Child profiles */}
        <div className="mb-6">
          <h3 className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-3">
            {language === "he" ? "פרופילי ילדים" : "Child Profiles"}
          </h3>
          <div className="flex gap-3">
            {user.childProfiles.map((child) => (
              <div key={child.id}
                className="flex-1 rounded-2xl bg-bg-card border border-bg-border p-3 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-bg-elevated border border-purple/20 flex items-center justify-center text-xl">
                  {child.avatarEmoji}
                </div>
                <span className="text-white text-sm font-medium">{child.name}</span>
                <span className="text-white/30 text-[10px] bg-bg-elevated px-2 py-0.5 rounded-full border border-bg-border">
                  {child.ageGroup} {language === "he" ? "שנים" : "yrs"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <h3 className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-3">
            {language === "he" ? "סטטיסטיקות" : "Stats"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: user.favoriteStoryIds.length, label: language === "he" ? "מועדפים" : "Favorites", color: "text-pink" },
              { value: user.recentlyPlayedIds.length, label: language === "he" ? "הושמעו" : "Played",    color: "text-teal" },
              { value: user.childProfiles.length,     label: language === "he" ? "ילדים" : "Children",   color: "text-purple-bright" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-bg-card border border-bg-border p-3 text-center">
                <p className={`font-bold text-xl leading-none ${stat.color}`}>{stat.value}</p>
                <p className="text-white/30 text-[10px] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settings list */}
        <div>
          <h3 className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-3">
            {language === "he" ? "הגדרות" : "Settings"}
          </h3>
          <div className="flex flex-col gap-1.5">
            {[
              { icon: "🔔", label: language === "he" ? "התראות" : "Notifications", value: language === "he" ? "פעיל" : "On" },
              { icon: "🌙", label: language === "he" ? "מצב לילה" : "Night Mode",   value: language === "he" ? "תמיד" : "Always" },
              { icon: "🔊", label: language === "he" ? "עוצמת קול" : "Volume",      value: "80%" },
            ].map((item) => (
              <button key={item.label}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-bg-border hover:border-teal/20 transition-colors text-left w-full">
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1 text-white/60 text-sm">{item.label}</span>
                <span className="text-white/25 text-xs">{item.value}</span>
                <span className="text-white/15 text-xs">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
