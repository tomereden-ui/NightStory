import type { Story, Voice, UserProfile, NavItem } from "@/types";

export const VOICES: Voice[] = [
  {
    id: "v1",
    name: "Luna",
    nameHe: "לונה",
    gender: "female",
    style: "warm",
    language: "en",
    avatarEmoji: "🌙",
  },
  {
    id: "v2",
    name: "Leo",
    nameHe: "ליאו",
    gender: "male",
    style: "playful",
    language: "en",
    avatarEmoji: "🦁",
  },
  {
    id: "v3",
    name: "Starlight",
    nameHe: "כוכבית",
    gender: "neutral",
    style: "calm",
    language: "he",
    avatarEmoji: "⭐",
  },
  {
    id: "v4",
    name: "Noa",
    nameHe: "נועה",
    gender: "female",
    style: "gentle",
    language: "he",
    avatarEmoji: "🌺",
  },
];

export const STORIES: Story[] = [
  {
    id: "s1",
    title: "The Dragon Who Was Afraid of the Dark",
    titleHe: "הדרקון שפחד מהחושך",
    description:
      "Ember the dragon discovers that the dark holds more wonders than fears, and learns that bravery is about taking that first small step.",
    descriptionHe:
      "גחלת הדרקון מגלה שהחושך מסתיר פלאים רבים, ולומד שאומץ הוא לקחת את הצעד הראשון.",
    coverEmoji: "🐉",
    coverColor: "#1A3A5C",
    durationSeconds: 720,
    ageGroup: "4-6",
    category: "fantasy",
    language: "en",
    voice: VOICES[0],
    tags: ["dragons", "courage", "bedtime"],
    tagsHe: ["דרקונים", "אומץ", "שינה"],
    isFeatured: true,
    isFavorite: true,
    playCount: 1842,
    createdAt: "2024-01-15",
    status: "published",
  },
  {
    id: "s2",
    title: "Stars and the Sleeping Moon",
    titleHe: "הכוכבים והירח הישן",
    description:
      "When the moon falls asleep too early, the little stars must work together to light up the night sky for all the children below.",
    descriptionHe:
      "כאשר הירח נרדם מוקדם מדי, הכוכבים הקטנים חייבים לעבוד יחד כדי להאיר את השמיים.",
    coverEmoji: "🌟",
    coverColor: "#1C2B4A",
    durationSeconds: 540,
    ageGroup: "2-4",
    category: "bedtime",
    language: "he",
    voice: VOICES[2],
    tags: ["stars", "moon", "teamwork"],
    tagsHe: ["כוכבים", "ירח", "עבודת צוות"],
    isFeatured: true,
    isFavorite: false,
    playCount: 2310,
    createdAt: "2024-02-01",
    status: "published",
  },
  {
    id: "s3",
    title: "Captain Finn and the Whale Song",
    titleHe: "קפטן פין ושיר הלוויתן",
    description:
      "A tiny sailor and a giant whale become the most unlikely of friends during a midnight ocean voyage filled with music and magic.",
    descriptionHe:
      "מלח קטן ולוויתן ענק הופכים לחברים הכי בלתי צפויים בהפלגת לילה מלאת מוזיקה וקסם.",
    coverEmoji: "🐋",
    coverColor: "#0E2640",
    durationSeconds: 840,
    ageGroup: "6-8",
    category: "adventure",
    language: "en",
    voice: VOICES[1],
    tags: ["ocean", "friendship", "music"],
    tagsHe: ["אוקיינוס", "חברות", "מוזיקה"],
    isFeatured: false,
    isFavorite: false,
    playCount: 987,
    createdAt: "2024-02-20",
    status: "published",
  },
  {
    id: "s4",
    title: "The Bunny Who Counted Clouds",
    titleHe: "הארנבון שספר עננים",
    description:
      "Little Benny the bunny can't fall asleep, so he begins counting clouds — and discovers that each one holds a dream waiting to happen.",
    descriptionHe:
      "ארנבון קטן לא יכול לישון, אז הוא מתחיל לספור עננים ומגלה שכל ענן מכיל חלום.",
    coverEmoji: "🐰",
    coverColor: "#1E3050",
    durationSeconds: 480,
    ageGroup: "2-4",
    category: "bedtime",
    language: "en",
    voice: VOICES[0],
    tags: ["sleep", "clouds", "dreams"],
    tagsHe: ["שינה", "עננים", "חלומות"],
    isFeatured: false,
    isFavorite: true,
    playCount: 3105,
    createdAt: "2024-03-05",
    status: "published",
  },
  {
    id: "s5",
    title: "אורית והיער הקסום",
    titleHe: "אורית והיער הקסום",
    description: "Orit steps into an enchanted forest and meets magical creatures.",
    descriptionHe:
      "אורית נכנסת ליער קסום ופוגשת יצורים מופלאים שמלמדים אותה על כוח הדמיון.",
    coverEmoji: "🌲",
    coverColor: "#142B1E",
    durationSeconds: 660,
    ageGroup: "4-6",
    category: "fairy-tale",
    language: "he",
    voice: VOICES[3],
    tags: ["forest", "magic", "imagination"],
    tagsHe: ["יער", "קסם", "דמיון"],
    isFeatured: true,
    isFavorite: false,
    playCount: 1560,
    createdAt: "2024-03-18",
    status: "published",
  },
  {
    id: "s6",
    title: "Robot Rex Finds His Heart",
    titleHe: "רובוט רקס מוצא את ליבו",
    description:
      "Rex is a robot who thinks he can't feel emotions — until a little girl named Maya shows him that kindness is the most powerful code of all.",
    descriptionHe:
      "רקס הוא רובוט שחושב שאינו יכול להרגיש — עד שילדה קטנה בשם מאיה מגלה לו את סוד הטוב.",
    coverEmoji: "🤖",
    coverColor: "#1A2540",
    durationSeconds: 780,
    ageGroup: "6-8",
    category: "adventure",
    language: "en",
    voice: VOICES[1],
    tags: ["robots", "kindness", "friendship"],
    tagsHe: ["רובוטים", "טוב לב", "חברות"],
    isFeatured: false,
    isFavorite: false,
    playCount: 723,
    createdAt: "2024-04-02",
    status: "published",
  },
];

export const MOCK_USER: UserProfile = {
  id: "u1",
  displayName: "Tomer",
  email: "tomer@example.com",
  avatarEmoji: "🌙",
  language: "en",
  preferredAgeGroup: "4-6",
  favoriteStoryIds: ["s1", "s4"],
  recentlyPlayedIds: ["s2", "s1", "s4", "s3"],
  subscriptionTier: "premium",
  subscriptionExpiresAt: "2025-01-01",
  childProfiles: [
    {
      id: "c1",
      name: "Maya",
      avatarEmoji: "🌸",
      ageGroup: "4-6",
      favoriteCategories: ["fantasy", "animals", "bedtime"],
    },
    {
      id: "c2",
      name: "Lior",
      avatarEmoji: "🚀",
      ageGroup: "6-8",
      favoriteCategories: ["adventure", "space"],
    },
  ],
  createdAt: "2024-01-01",
};

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", labelHe: "בית", href: "/", icon: "🏠" },
  {
    id: "library",
    label: "Library",
    labelHe: "ספרייה",
    href: "/library",
    icon: "📚",
  },
  {
    id: "player",
    label: "Player",
    labelHe: "נגן",
    href: "/player",
    icon: "🎵",
  },
  {
    id: "profile",
    label: "Profile",
    labelHe: "פרופיל",
    href: "/profile",
    icon: "👤",
  },
];

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function getFeaturedStories(): Story[] {
  return STORIES.filter((s) => s.isFeatured);
}

export function getRecentStories(ids: string[]): Story[] {
  return ids
    .map((id) => STORIES.find((s) => s.id === id))
    .filter(Boolean) as Story[];
}
