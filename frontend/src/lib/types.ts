export type WorkspaceRole = "viewer" | "editor" | "admin" | "owner";
export type Platform =
  "tiktok" | "instagram" | "facebook" | "pinterest" | "twitter" | "linkedin";

export interface ApiEnvelope<T> {
  data: T;
  meta?: { nextCursor?: string | null };
}
export interface ApiFailure {
  error: { code: string; message: string; details?: unknown };
}
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  defaultWorkspaceId: string | null;
}
export interface AuthResult {
  accessToken: string;
  expiresIn: string;
  user: User;
}
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  planId: "free" | "starter" | "pro" | "agency";
  timezone: string;
  role?: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceMember {
  id: string;
  userId: string | null;
  role: WorkspaceRole;
  invitedEmail: string | null;
  status: "active" | "pending";
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
}
export interface PlatformAvailability {
  platform: Platform;
  implemented: boolean;
  configured: boolean;
  capabilities: {
    supportsSlideshow: boolean;
    maxSlideshowImages?: number;
    slideshowImageRange?: [number, number] | null;
    supportsVideo: boolean;
    supportsPost: boolean;
    allowsTextOnlyPost: boolean;
    supportsMentions: boolean;
    supportsReplies: boolean;
  } | null;
}
export interface SocialAccount {
  id: string;
  _id?: string;
  platform: Platform;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  lastError: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  voiceProfileId: string | null;
  voiceIngestionConsentedAt: string | null;
  connectionProvider: "direct" | "buffer" | "postiz";
  providerChannelType: string | null;
  publishingDefaults: Record<string, unknown>;
}

export type PublishingProvider = "buffer" | "postiz";
export interface PublishingConnection {
  id: string;
  provider: PublishingProvider;
  keyHint: string;
  organizationId: string | null;
  organizationName: string | null;
  baseUrl: string | null;
  status: string;
  lastError: string | null;
  lastValidatedAt: string | null;
  updatedAt: string;
}
export interface PublishingOrganization {
  id: string;
  name: string;
}
export interface PublishingChannel {
  id: string;
  name: string;
  avatarUrl: string | null;
  platform: Platform;
  providerType: string;
  disabled: boolean;
}
export interface PublishingDiscovery {
  organizations: PublishingOrganization[];
  channels: PublishingChannel[];
}
export interface AiModel {
  id: string;
  name: string;
  provider?: AiProvider;
  capabilities?: string[];
}
export type AiProvider = "openai" | "anthropic" | "gemini";
export interface AiCredential {
  provider: AiProvider;
  keyHint: string;
  defaultModel: string;
  preferred?: boolean;
  updatedAt: string;
}
export interface MediaAsset {
  id?: string;
  _id?: string;
  url: string;
  fileName?: string;
  mimeType: string;
  sizeBytes: number;
  type: "image" | "video";
  tags: string[];
  width: number | null;
  height: number | null;
  createdAt: string;
}
export interface ContentItem {
  id?: string;
  _id?: string;
  type: "slideshow" | "video" | "post";
  goal: string | null;
  targetCountry?: string | null;
  language?: string | null;
  postCaption: string;
  hashtags: string[];
  status: string;
  generationSource: "ai" | "manual" | "api";
  aiProvider: AiProvider | null;
  aiModel: string | null;
  slideshow?: {
    slides: {
      order: number;
      imageUrl: string;
      caption: string | null;
      altText: string | null;
    }[];
  } | null;
  post?: { imageUrls: string[]; text: string } | null;
  video?: {
    videoUrl: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    status: string;
  } | null;
  createdAt: string;
}
export interface ScheduledPost {
  id?: string;
  _id?: string;
  contentId: string;
  socialAccountId: string;
  platform: Platform;
  scheduledFor: string;
  status: string;
  attempts: number;
  publishedAt: string | null;
  platformPostUrl: string | null;
  failureReason: string | null;
}
export interface Schedule {
  id?: string;
  _id?: string;
  name: string;
  socialAccountIds: string[];
  contentTypeMix: { slideshow: number; video: number; post: number };
  mode: "fixed_days" | "volume";
  fixedDays?: {
    postsPerWeek: number;
    daysOfWeek: number[];
    timeOfDay: string;
  } | null;
  volume?: {
    postsPerMonth: number;
    postingWindows: { startHour: number; endHour: number }[];
    minGapMinutes: number;
    jitterMinutes: number;
  } | null;
  contentSource: string;
  autoGeneratePrompt?: string | null;
  defaultGoal: string;
  defaultImageSource: string;
  autopilot: boolean;
  status: string;
  websiteUrl?: string | null;
  websiteBrief?: string | null;
  tiktokInsights?: string | null;
  cadence?: "daily" | "weekly" | null;
  timesOfDay?: string[];
  postsPerPeriod?: number | null;
  targetCountry?: string | null;
  language?: string | null;
  postingTimeZone?: string | null;
  brandResearch?: BrandResearch | null;
  createdAt: string;
  updatedAt?: string;
}
export interface PostingTimeSuggestion {
  times: string[];
  timeZone: string;
  rationale: string;
}
export interface BrandResearch {
  productName: string;
  oneLiner: string;
  audience: string;
  valueProps: string[];
  websiteBrief: string;
  tiktokInsights: string;
  suggestedAngles: string[];
  competitors?: string[];
  competitorAccounts?: string[];
  websiteUrl: string;
}
export interface AutomationStartResult {
  queued: number;
  schedule: Schedule;
  research: {
    productName: string;
    websiteBrief: string;
    tiktokInsights: string;
  };
}
export interface VoiceProfile {
  userSetTone: string[];
  styleSummary: string;
  styleAttributes: {
    avgSentenceLength: number;
    emojiUsage: string;
    hashtagUsage: string;
    commonTopics: string[];
    formattingNotes: string;
  };
  sampleCount: number;
  lastAnalyzedAt: string | null;
}
