"use client";

import { useLanguage } from "@/context/LanguageContext";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

const TIER_BADGE: Record<string, { label: string; color: string; emoji: string }> = {
  free:    { label: "Free",    color: "rgba(255,255,255,0.3)",  emoji: "🌱" },
  basic:   { label: "Basic",   color: "#00D4FF",               emoji: "⭐" },
  premium: { label: "Premium", color: "#8B5CF6",               emoji: "👑" },
  family:  { label: "Family",  color: "#EC4899",               emoji: "🏡" },
};

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <button
      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-colors"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-white/55 text-sm">{label}</span>
      <span className="text-white/25 text-xs">{value}</span>
      <span className="text-white/15 text-xs">›</span>
    </button>
  );
}

export default function ProfilePage() {
  const { t, language, isRTL } = useLanguage();
  const user = MOCK_USER;
  const tier = TIER_BADGE[user.subscriptionTier] ?? TIER_BADGE.free;

  return (
    <div className="min-h-full" style={{ background: "#0A0C14" }} dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-base font-semibold text-white tracking-wide">{t("profile")}</h1>
          <LanguageToggle />
        </div>

        {/* Avatar & name */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3"
            style={{ background: "rgba(255,255,255,0.06)", border: "2px solid rgba(0,212,255,0.25)" }}
          >
            {user.avatarEmoji}
          </div>
          <h2 className="text-white text-xl font-bold">{user.displayName}</h2>
          <p className="text-white/35 text-sm mt-0.5">{user.email}</p>

          {/* Tier badge */}
          <div
            className="flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${tier.color}40`,
              color: tier.color,
            }}
          >
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
          <h3 className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">
            {language === "he" ? "פרופילי ילדים" : "Child Profiles"}
          </h3>
          <div className="flex gap-3">
            {user.childProfiles.map((child) => (
              <div
                key={child.id}
                className="flex-1 rounded-2xl p-3 flex flex-col items-center gap-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {child.avatarEmoji}
                </div>
                <span className="text-white text-sm font-medium">{child.name}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)" }}
                >
                  {child.ageGroup} {language === "he" ? "שנים" : "yrs"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <h3 className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">
            {language === "he" ? "סטטיסטיקות" : "Stats"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: user.favoriteStoryIds.length, label: language === "he" ? "מועדפים" : "Favorites", color: "#EC4899" },
              { value: user.recentlyPlayedIds.length, label: language === "he" ? "הושמעו" : "Played",    color: "#00D4FF" },
              { value: user.childProfiles.length,     label: language === "he" ? "ילדים" : "Children",   color: "#8B5CF6" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="font-bold text-xl leading-none" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-white/30 text-[10px] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div>
          <h3 className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">
            {language === "he" ? "הגדרות" : "Settings"}
          </h3>
          <div className="flex flex-col gap-1.5">
            <Row icon="🔔" label={language === "he" ? "התראות" : "Notifications"} value={language === "he" ? "פעיל" : "On"} />
            <Row icon="🌙" label={language === "he" ? "מצב לילה" : "Night Mode"} value={language === "he" ? "תמיד" : "Always"} />
            <Row icon="🔊" label={language === "he" ? "עוצמת קול" : "Volume"} value="80%" />
          </div>
        </div>
      </div>
    </div>
  );
}
