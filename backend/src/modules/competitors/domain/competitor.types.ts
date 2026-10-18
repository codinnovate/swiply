/** Networks the picker offers. Only the ones in SUPPORTED_NETWORKS have sources. */
export const COMPETITOR_NETWORKS = ['tiktok', 'instagram', 'youtube', 'facebook', 'x'] as const;
export type CompetitorNetwork = (typeof COMPETITOR_NETWORKS)[number];
export const SUPPORTED_NETWORKS: readonly CompetitorNetwork[] = ['tiktok'];

export interface CompetitorProfile {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  verified: boolean;
  followers: number | null;
  following: number | null;
  likes: number | null;
  videoCount: number | null;
  profileUrl: string;
}

export interface CompetitorVideo {
  id: string;
  url: string;
  caption: string;
  hashtags: string[];
  coverUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** (likes + comments + shares + saves) / views, 0 when views are unknown. */
  engagementRate: number;
  /** TikTok marked the post as an ad or paid partnership (e.g. a Spark Ad). */
  isPromoted: boolean;
  isPinned: boolean;
  music: string | null;
}

export interface CompetitorAd {
  id: string;
  advertiserName: string;
  paidFor: string | null;
  firstShownAt: string | null;
  lastShownAt: string | null;
  status: string | null;
  /** TikTok reports reach as a bucket such as "10K-100K". */
  reach: string | null;
  videoUrls: string[];
  imageUrls: string[];
  libraryUrl: string;
}

export interface HashtagStat {
  tag: string;
  uses: number;
  totalViews: number;
  avgViews: number;
  avgEngagementRate: number;
  lastUsedAt: string;
}

export interface CompetitorSummary {
  videosAnalyzed: number;
  totalViews: number;
  avgViews: number;
  medianViews: number;
  avgEngagementRate: number;
  postsPerWeek: number;
  promotedCount: number;
  topHashtag: string | null;
  /** 0 = Sunday … 6 = Saturday, UTC. */
  bestWeekday: number | null;
  bestHourUtc: number | null;
  firstPostAt: string | null;
  lastPostAt: string | null;
}

export interface PerformancePoint {
  /** Monday (UTC) that starts the week, YYYY-MM-DD. */
  weekStart: string;
  videos: number;
  views: number;
  engagementRate: number;
}

export type SourceState = 'ok' | 'empty' | 'not_configured' | 'failed';
export interface SourceStatus {
  state: SourceState;
  message?: string;
}

export interface CompetitorReportData {
  network: CompetitorNetwork;
  company: string;
  handle: string;
  profile: CompetitorProfile | null;
  summary: CompetitorSummary;
  hashtags: HashtagStat[];
  videos: CompetitorVideo[];
  ads: CompetitorAd[];
  performance: PerformancePoint[];
  sources: { videos: SourceStatus; ads: SourceStatus };
  fetchedAt: string;
}

export interface ProfileVideos {
  profile: CompetitorProfile | null;
  videos: CompetitorVideo[];
}

/** A public-video source for one network, swappable per provider. */
export interface CompetitorVideoSource {
  isConfigured(): boolean;
  fetchProfileVideos(handle: string, limit: number): Promise<ProfileVideos>;
}

/** An ad-transparency source for one network. */
export interface CompetitorAdSource {
  isConfigured(): boolean;
  searchAds(company: string): Promise<CompetitorAd[]>;
}

export const TIKTOK_VIDEO_SOURCE = Symbol('TIKTOK_VIDEO_SOURCE');
export const TIKTOK_AD_SOURCE = Symbol('TIKTOK_AD_SOURCE');

/** Thrown by a video source when the handle has no public profile. */
export class CompetitorProfileNotFoundError extends Error {
  constructor(readonly handle: string) {
    super(`No public profile found for @${handle}`);
  }
}
