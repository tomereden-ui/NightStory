import type { Language } from "@/types";

export const RTL_LANGUAGES: Language[] = ["he"];

export function isRTL(language: Language): boolean {
  return RTL_LANGUAGES.includes(language);
}

export function getDir(language: Language): "rtl" | "ltr" {
  return isRTL(language) ? "rtl" : "ltr";
}

export const translations = {
  en: {
    appName: "NightStory",
    tagline: "Magical stories for little dreamers",
    featuredStories: "Featured Stories",
    recentlyPlayed: "Recently Played",
    allStories: "All Stories",
    goodNight: "Good Night",
    listenNow: "Listen Now",
    favorites: "Favorites",
    minutes: "min",
    home: "Home",
    library: "Library",
    player: "Player",
    profile: "Profile",
    search: "Search stories...",
    noFavorites: "No favorites yet",
    startListening: "Start listening to add favorites",
    premiumBadge: "Premium",
    freeBadge: "Free",
    continueListening: "Continue Listening",
    newStory: "New Story",
    forYou: "For You",
  },
  he: {
    appName: "נייטסטורי",
    tagline: "סיפורים קסומים לחולמים הקטנים",
    featuredStories: "סיפורים מומלצים",
    recentlyPlayed: "הושמע לאחרונה",
    allStories: "כל הסיפורים",
    goodNight: "לילה טוב",
    listenNow: "האזן עכשיו",
    favorites: "מועדפים",
    minutes: "דק׳",
    home: "בית",
    library: "ספרייה",
    player: "נגן",
    profile: "פרופיל",
    search: "חפש סיפורים...",
    noFavorites: "עוד אין מועדפים",
    startListening: "התחל להאזין כדי להוסיף מועדפים",
    premiumBadge: "פרימיום",
    freeBadge: "חינם",
    continueListening: "המשך האזנה",
    newStory: "סיפור חדש",
    forYou: "בשבילך",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(language: Language, key: TranslationKey): string {
  return translations[language][key] ?? translations.en[key];
}
