import type { Story, Voice, UserProfile, NavItem, ScriptBlock } from "@/types";

export const VOICES: Voice[] = [
  { id: "v1", name: "Luna", nameHe: "לונה", gender: "female", style: "warm", language: "en", avatarEmoji: "🌙", avatarUrl: "/api/voices/avatar/v1", elevenLabsId: "21m00Tcm4TlvDq8ikWAM", geminiVoiceName: "Kore" },
  { id: "v2", name: "Leo", nameHe: "ליאו", gender: "male", style: "playful", language: "en", avatarEmoji: "🦁", avatarUrl: "/api/voices/avatar/v2", elevenLabsId: "VR6AewLTigWG4xSOukaG", geminiVoiceName: "Puck" },
  { id: "v3", name: "Starlight", nameHe: "כוכבית", gender: "neutral", style: "calm", language: "he", avatarEmoji: "⭐", avatarUrl: "/api/voices/avatar/v3", elevenLabsId: "GBv7mTt0atIp3Br8iCZE", geminiVoiceName: "Aoede" },
  { id: "v4", name: "Noa", nameHe: "נועה", gender: "female", style: "gentle", language: "he", avatarEmoji: "🌺", avatarUrl: "/api/voices/avatar/v4", elevenLabsId: "LcfcDJNUP1GQjkzn1xUU", geminiVoiceName: "Fenrir" },
];

export const STORIES: Story[] = [
  {
    id: "s1",
    title: "The Waves of Whispers",
    titleHe: "גלי הלחישות",
    description: "The ocean holds a thousand secrets — and tonight, the waves finally speak.",
    descriptionHe: "האוקיינוס מסתיר אלף סודות — והלילה, הגלים סוף סוף מדברים.",
    coverEmoji: "🌊",
    coverColor: "#031628",
    coverGradient: "radial-gradient(ellipse at 40% 30%, #0a3a5c 0%, #021018 60%, #010810 100%)",
    durationSeconds: 720,
    ageGroup: "6-8",
    category: "adventure",
    language: "en",
    voice: VOICES[0],
    tags: ["ocean", "mystery", "bedtime"],
    tagsHe: ["אוקיינוס", "מסתורין", "שינה"],
    isFeatured: true,
    isFavorite: true,
    playCount: 3421,
    createdAt: "2024-01-10",
    status: "published",
  },
  {
    id: "s2",
    title: "Midnight at the Glass Lake",
    titleHe: "חצות באגם הזכוכית",
    description: "The lake reflects not the sky, but the dreams of every child who has ever looked into it.",
    descriptionHe: "האגם לא מחזיר את השמים, אלא את חלומות כל ילד שהציץ לתוכו.",
    coverEmoji: "🌙",
    coverColor: "#050e1f",
    coverGradient: "radial-gradient(ellipse at 50% 25%, #162a5e 0%, #050e1f 55%, #020812 100%)",
    durationSeconds: 540,
    ageGroup: "4-6",
    category: "bedtime",
    language: "he",
    voice: VOICES[2],
    tags: ["moon", "lake", "dreams"],
    tagsHe: ["ירח", "אגם", "חלומות"],
    isFeatured: true,
    isFavorite: false,
    playCount: 5102,
    createdAt: "2024-02-01",
    status: "published",
  },
  {
    id: "s3",
    title: "The Clockwork Constellation",
    titleHe: "קבוצת הכוכבים המכנית",
    description: "A clockmaker's daughter discovers the stars are tiny gears keeping time for the universe.",
    descriptionHe: "בתו של שען מגלה שהכוכבים הם גלגלי שיניים קטנים השומרים על הזמן.",
    coverEmoji: "⚙️",
    coverColor: "#120e00",
    coverGradient: "radial-gradient(ellipse at 50% 30%, #3d2800 0%, #120e00 55%, #080600 100%)",
    durationSeconds: 780,
    ageGroup: "6-8",
    category: "adventure",
    language: "en",
    voice: VOICES[1],
    tags: ["space", "clockwork", "mystery"],
    tagsHe: ["חלל", "שעון", "מסתורין"],
    isFeatured: true,
    isFavorite: false,
    playCount: 2817,
    createdAt: "2024-02-20",
    status: "published",
  },
  {
    id: "s4",
    title: "Echoes of Ancient Pines",
    titleHe: "הדי האורנים הקדומים",
    description: "Deep in the ancient forest, the trees remember everything — every laugh, every tear.",
    descriptionHe: "עמוק ביער העתיק, העצים זוכרים הכל — כל צחוק, כל דמעה.",
    coverEmoji: "🌲",
    coverColor: "#041408",
    coverGradient: "radial-gradient(ellipse at 50% 30%, #0a3d20 0%, #041408 55%, #020a04 100%)",
    durationSeconds: 660,
    ageGroup: "4-6",
    category: "fairy-tale",
    language: "en",
    voice: VOICES[0],
    tags: ["forest", "magic", "ancient"],
    tagsHe: ["יער", "קסם", "עתיק"],
    isFeatured: false,
    isFavorite: true,
    playCount: 1944,
    createdAt: "2024-03-05",
    status: "published",
  },
  {
    id: "s5",
    title: "Silk and Starlight",
    titleHe: "משי ואור כוכבים",
    description: "A weaver of dreams crafts the night sky from threads of pure starlight and wishes.",
    descriptionHe: "אורגת חלומות שוזרת את שמי הלילה מחוטי אור כוכבים ומשאלות.",
    coverEmoji: "✨",
    coverColor: "#100520",
    coverGradient: "radial-gradient(ellipse at 50% 30%, #2d1b69 0%, #100520 55%, #070312 100%)",
    durationSeconds: 480,
    ageGroup: "2-4",
    category: "bedtime",
    language: "he",
    voice: VOICES[3],
    tags: ["stars", "weaving", "dreams"],
    tagsHe: ["כוכבים", "אריגה", "חלומות"],
    isFeatured: true,
    isFavorite: false,
    playCount: 3388,
    createdAt: "2024-03-18",
    status: "published",
  },
  {
    id: "s6",
    title: "The Dragon Who Was Afraid of the Dark",
    titleHe: "הדרקון שפחד מהחושך",
    description: "Ember the dragon discovers the dark holds more wonders than fears.",
    descriptionHe: "גחלת הדרקון מגלה שהחושך מסתיר פלאים רבים יותר מפחדים.",
    coverEmoji: "🐉",
    coverColor: "#0f0820",
    coverGradient: "radial-gradient(ellipse at 45% 35%, #2d1b69 0%, #0f0820 55%, #060412 100%)",
    durationSeconds: 720,
    ageGroup: "4-6",
    category: "fantasy",
    language: "en",
    voice: VOICES[1],
    tags: ["dragons", "courage", "bedtime"],
    tagsHe: ["דרקונים", "אומץ", "שינה"],
    isFeatured: false,
    isFavorite: false,
    playCount: 1842,
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
    { id: "c1", name: "Maya", avatarEmoji: "🌸", ageGroup: "4-6", age: 5, favoriteCategories: ["fantasy", "animals", "bedtime"] },
    { id: "c2", name: "Lior", avatarEmoji: "🚀", ageGroup: "6-8", age: 7, favoriteCategories: ["adventure", "space"] },
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
