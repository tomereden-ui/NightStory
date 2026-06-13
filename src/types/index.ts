export type Language = "en" | "he" | "es" | "fr" | "de" | "pt" | "ar" | "zh" | "ja" | "it";

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
}

export interface GeneratedScriptState {
  storyId: string;
  blocks: ScriptBlock[];
}
