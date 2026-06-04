import type { Story, Voice, UserProfile, NavItem, ScriptBlock } from "@/types";

export const VOICES: Voice[] = [
  { id: "v1", name: "Luna", nameHe: "לונה", gender: "female", style: "warm", language: "en", avatarEmoji: "🌙" },
  { id: "v2", name: "Leo", nameHe: "ליאו", gender: "male", style: "playful", language: "en", avatarEmoji: "🦁" },
  { id: "v3", name: "Starlight", nameHe: "כוכבית", gender: "neutral", style: "calm", language: "he", avatarEmoji: "⭐" },
  { id: "v4", name: "Noa", nameHe: "נועה", gender: "female", style: "gentle", language: "he", avatarEmoji: "🌺" },
];

export const STORIES: Story[] = [
  {
    id: "s1",
    title: "The Dragon Who Was Afraid of the Dark",
    titleHe: "הדרקון שפחד מהחושך",
    description: "Ember the dragon discovers that the dark holds more wonders than fears.",
    descriptionHe: "גחלת הדרקון מגלה שהחושך מסתיר פלאים רבים.",
    coverEmoji: "🐉",
    coverColor: "#1a1040",
    coverGradient: "linear-gradient(135deg, #1a1040 0%, #2d1b69 50%, #0a0520 100%)",
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
    description: "When the moon falls asleep too early, the little stars must light up the night sky.",
    descriptionHe: "כאשר הירח נרדם מוקדם מדי, הכוכבים הקטנים חייבים להאיר את השמיים.",
    coverEmoji: "🌟",
    coverColor: "#0a1530",
    coverGradient: "linear-gradient(135deg, #0a1530 0%, #162a5e 50%, #050d20 100%)",
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
    description: "A tiny sailor and a giant whale become the most unlikely of friends.",
    descriptionHe: "מלח קטן ולוויתן ענק הופכים לחברים הכי בלתי צפויים.",
    coverEmoji: "🐋",
    coverColor: "#001a2e",
    coverGradient: "linear-gradient(135deg, #001a2e 0%, #003a5c 50%, #000d1a 100%)",
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
    description: "Little Benny the bunny can't fall asleep, so he begins counting clouds.",
    descriptionHe: "ארנבון קטן לא יכול לישון, אז הוא מתחיל לספור עננים.",
    coverEmoji: "🐰",
    coverColor: "#1a0a2e",
    coverGradient: "linear-gradient(135deg, #1a0a2e 0%, #3d1a5e 50%, #0d0520 100%)",
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
    descriptionHe: "אורית נכנסת ליער קסום ופוגשת יצורים מופלאים.",
    coverEmoji: "🌲",
    coverColor: "#041a0e",
    coverGradient: "linear-gradient(135deg, #041a0e 0%, #0a3d20 50%, #020d07 100%)",
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
    title: "The Clockwork Constellation",
    titleHe: "קבוצת הכוכבים המכנית",
    description: "A clockmaker's daughter discovers that the stars are actually tiny gears keeping time for the universe.",
    descriptionHe: "בתו של שען מגלה שהכוכבים הם גלגלי שיניים קטנים.",
    coverEmoji: "⚙️",
    coverColor: "#1a1000",
    coverGradient: "linear-gradient(135deg, #1a1000 0%, #3d2800 50%, #0d0800 100%)",
    durationSeconds: 780,
    ageGroup: "6-8",
    category: "adventure",
    language: "en",
    voice: VOICES[1],
    tags: ["space", "clockwork", "mystery"],
    tagsHe: ["חלל", "שעון", "מסתורין"],
    isFeatured: true,
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
  recentlyPlayedIds: ["s6", "s1", "s4", "s3"],
  subscriptionTier: "premium",
  subscriptionExpiresAt: "2025-01-01",
  childProfiles: [
    { id: "c1", name: "Maya", avatarEmoji: "🌸", ageGroup: "4-6", favoriteCategories: ["fantasy", "animals", "bedtime"] },
    { id: "c2", name: "Lior", avatarEmoji: "🚀", ageGroup: "6-8", favoriteCategories: ["adventure", "space"] },
  ],
  createdAt: "2024-01-01",
};

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Stories", labelHe: "סיפורים", href: "/", icon: "📖" },
  { id: "library", label: "Create", labelHe: "צור", href: "/create", icon: "✨" },
  { id: "player", label: "Player", labelHe: "נגן", href: "/player", icon: "🎵" },
  { id: "profile", label: "Profile", labelHe: "פרופיל", href: "/profile", icon: "👤" },
];

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function getFeaturedStories(): Story[] {
  return STORIES.filter((s) => s.isFeatured);
}

export function getRecentStories(ids: string[]): Story[] {
  return ids.map((id) => STORIES.find((s) => s.id === id)).filter(Boolean) as Story[];
}

export const STORY_SETTINGS = [
  { id: "magic-forest", label: "Magic Forest", labelHe: "יער קסום", emoji: "🌲" },
  { id: "dinosaurs",    label: "Dinosaurs",    labelHe: "דינוזאורים", emoji: "🦕" },
  { id: "space",        label: "Space",        labelHe: "חלל",         emoji: "🚀" },
  { id: "underwater",   label: "Underwater",   labelHe: "מתחת למים",   emoji: "🐚" },
  { id: "dragons",      label: "Dragons",      labelHe: "דרקונים",     emoji: "🐉" },
  { id: "fairies",      label: "Fairies",      labelHe: "פיות",        emoji: "🧚" },
];

function blockId(order: number): string {
  return `blk-${order}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateMockScript(
  hero: string,
  settingId: string,
  primaryVoiceId: string
): ScriptBlock[] {
  const settingLabel =
    STORY_SETTINGS.find((s) => s.id === settingId)?.label.toLowerCase() ??
    "a magical place";
  const heroName = hero.trim() || "the brave one";

  return [
    {
      id: blockId(1),
      blockOrder: 1,
      characterName: "Narrator",
      assignedVoiceId: "v1",
      textPayload: `Once upon a time, in ${settingLabel} where stars touched the ground, there lived ${heroName}.`,
    },
    {
      id: blockId(2),
      blockOrder: 2,
      characterName: heroName,
      assignedVoiceId: primaryVoiceId,
      textPayload: `"Tonight," whispered ${heroName}, "I will discover what lies beyond the shimmer."`,
    },
    {
      id: blockId(3),
      blockOrder: 3,
      characterName: "Narrator",
      assignedVoiceId: "v1",
      textPayload: `The ${settingLabel} hummed with ancient secrets, each shadow hiding a story waiting to be found.`,
    },
    {
      id: blockId(4),
      blockOrder: 4,
      characterName: "Wise Guide",
      assignedVoiceId: "v3",
      textPayload: `"You carry the light within you," said the Wise Guide, voice gentle as falling snow. "Trust it."`,
    },
    {
      id: blockId(5),
      blockOrder: 5,
      characterName: heroName,
      assignedVoiceId: primaryVoiceId,
      textPayload: `${heroName} took a deep breath, stepped forward — and smiled. The ${settingLabel} lit up in reply.`,
    },
    {
      id: blockId(6),
      blockOrder: 6,
      characterName: "Narrator",
      assignedVoiceId: "v1",
      textPayload: `And so, under a sky full of patient stars, the most wonderful adventure began — one block of wonder at a time.`,
    },
  ];
}
