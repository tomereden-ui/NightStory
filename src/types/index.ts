export type Language = "en" | "he" | "es" | "fr" | "de" | "pt" | "ar" | "ja" | "it" | "hi";

export type AgeGroup = "2-4" | "4-6" | "6-8" | "8-10" | "10-12";

export type StoryCategory =
  | "adventure"
  | "fantasy"
  | "animals"
  | "bedtime"
  | "friendship"
  | "nature"
  | "space"
  | "fairy-tale";

export type VoiceGender = "male" | "female" | "neutral";

export type VoiceStyle = "warm" | "playful" | "calm" | "dramatic" | "gentle";

export interface Voice {
  id: string;
  name: string;
  nameHe?: string;
  gender: VoiceGender;
  style: VoiceStyle;
  language: Language;
  previewUrl?: string;
  avatarEmoji: string;
  /** Generated person-portrait thumbnail matching this voice's character (see /api/voices/avatar). */
  avatarUrl?: string;
  /** ElevenLabs voice ID used when this voice is assigned to a character in production. */
  elevenLabsId?: string;
  /** Gemini TTS prebuilt voice name used when this voice is assigned to a character in production. */
  geminiVoiceName?: string;
}

export type StoryStatus = "published" | "draft" | "generating";

export interface Story {
  id: string;
  title: string;
  titleHe?: string;
  description: string;
  descriptionHe?: string;
  coverEmoji: string;
  coverColor: string;
  coverGradient?: string;
  audioUrl?: string;
  durationSeconds: number;
  ageGroup: AgeGroup;
  category: StoryCategory;
  language: Language;
  voice: Voice;
  tags: string[];
  tagsHe?: string[];
  isFeatured: boolean;
  isFavorite?: boolean;
  playCount: number;
  createdAt: string;
  status: StoryStatus;
}

export type SubscriptionTier = "free" | "basic" | "premium" | "family";

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarEmoji: string;
  language: Language;
  preferredAgeGroup?: AgeGroup;
  favoriteStoryIds: string[];
  recentlyPlayedIds: string[];
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt?: string;
  childProfiles: ChildProfile[];
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  ageGroup: AgeGroup;
  age?: number;
  favoriteCategories: StoryCategory[];
}

export interface PlaybackState {
  storyId: string | null;
  isPlaying: boolean;
  currentTimeSeconds: number;
  durationSeconds: number;
  volume: number;
}

export interface NavItem {
  id: string;
  label: string;
  labelHe: string;
  href: string;
  icon: string;
}

export interface ScriptBlock {
  id: string;
  blockOrder: number;
  characterName: string;
  assignedVoiceId: string;
  textPayload: string;
  lessonHighlight?: { lesson: string; how: string };
  validated?: boolean;
}

export interface StoryScene {
  sceneNumber: number;
  title: string;
  summary: string;
  primaryMood: string;
  sfxTags: string[];
  /** 0-based block indices, inclusive on both ends */
  lineRange: { start: number; end: number };
  /** Pre-computed from word count at 130 WPM */
  estimatedDurationSeconds?: number;
}

export interface GeneratedScriptState {
  storyId: string;
  blocks: ScriptBlock[];
}
