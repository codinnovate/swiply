import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { engagementRate, extractHashtags } from '../domain/competitor-analysis';
import {
  CompetitorProfileNotFoundError,
  type CompetitorProfile,
  type CompetitorVideo,
  type CompetitorVideoSource,
  type ProfileVideos,
} from '../domain/competitor.types';

/** The subset of a clockworks/tiktok-scraper dataset item this module reads. */
export interface ApifyTiktokItem {
  id?: string;
  text?: string;
  createTime?: number;
  createTimeISO?: string;
  webVideoUrl?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  collectCount?: number | string;
  isAd?: boolean;
  isSponsored?: boolean;
  isPinned?: boolean;
  hashtags?: Array<{ name?: string } | string>;
  videoMeta?: { duration?: number; coverUrl?: string; originalCoverUrl?: string };
  musicMeta?: { musicName?: string; musicAuthor?: string };
  authorMeta?: {
    name?: string;
    nickName?: string;
    verified?: boolean;
    signature?: string;
    avatar?: string;
    fans?: number;
    following?: number;
    heart?: number;
    video?: number;
  };
  error?: string;
}

const APIFY_ORIGIN = 'https://api.apify.com';
/** Apify caps a synchronous run at 300 s; stay well inside the proxy's budget. */
const RUN_TIMEOUT_SECONDS = 150;

/**
 * Public TikTok profile videos through Apify's TikTok scraper actor. TikTok
 * has no official API for other accounts' videos, and the free Apify plan's
 * monthly credit covers a few thousand videos.
 */
@Injectable()
export class ApifyTiktokVideoSource implements CompetitorVideoSource {
  private readonly logger = new Logger(ApifyTiktokVideoSource.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('research.apifyToken'));
  }

  async fetchProfileVideos(handle: string, limit: number): Promise<ProfileVideos> {
    const token = this.config.get<string>('research.apifyToken');
    const actor = this.config.get<string>('research.apifyTiktokActor', 'clockworks~tiktok-scraper');
    const url = new URL(`/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`, APIFY_ORIGIN);
    url.searchParams.set('timeout', String(RUN_TIMEOUT_SECONDS));
    url.searchParams.set('clean', 'true');

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout((RUN_TIMEOUT_SECONDS + 15) * 1000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        profiles: [handle],
        resultsPerPage: limit,
        profileScrapeSections: ['videos'],
        profileSorting: 'latest',
        excludePinnedPosts: false,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadAvatars: false,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(`Apify run for @${handle} failed with ${response.status}: ${detail.slice(0, 300)}`);
      throw new Error(apifyFailureMessage(response.status));
    }
    const items = (await response.json()) as unknown;
    return parseApifyTiktokItems(handle, Array.isArray(items) ? (items as ApifyTiktokItem[]) : []);
  }
}

export function parseApifyTiktokItems(handle: string, items: ApifyTiktokItem[]): ProfileVideos {
  const videos: CompetitorVideo[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.id || item.error || seen.has(item.id)) continue;
    // Profile scrapes can include duets and reposts from other authors.
    const author = item.authorMeta?.name?.toLowerCase();
    if (author && author !== handle) continue;
    seen.add(item.id);
    videos.push(toVideo(handle, item));
  }
  if (!videos.length) throw new CompetitorProfileNotFoundError(handle);
  const author = items.find((item) => item?.authorMeta?.name?.toLowerCase() === handle)?.authorMeta;
  return {
    profile: author ? toProfile(handle, author) : null,
    videos: videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function toVideo(handle: string, item: ApifyTiktokItem): CompetitorVideo {
  const caption = item.text ?? '';
  const createdAt = item.createTimeISO
    ? new Date(item.createTimeISO).toISOString()
    : new Date((item.createTime ?? 0) * 1000).toISOString();
  const provided = (item.hashtags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag?.name ?? ''));
  const metrics = {
    views: count(item.playCount),
    likes: count(item.diggCount),
    comments: count(item.commentCount),
    shares: count(item.shareCount),
    saves: count(item.collectCount),
  };
  return {
    id: item.id as string,
    url: item.webVideoUrl || `https://www.tiktok.com/@${handle}/video/${item.id}`,
    caption,
    hashtags: extractHashtags(caption, provided),
    coverUrl: item.videoMeta?.coverUrl || item.videoMeta?.originalCoverUrl || null,
    durationSeconds: typeof item.videoMeta?.duration === 'number' ? item.videoMeta.duration : null,
    createdAt,
    ...metrics,
    engagementRate: engagementRate(metrics),
    isPromoted: Boolean(item.isAd || item.isSponsored),
    isPinned: Boolean(item.isPinned),
    music: item.musicMeta?.musicName
      ? [item.musicMeta.musicName, item.musicMeta.musicAuthor].filter(Boolean).join(' — ')
      : null,
  };
}

function toProfile(handle: string, author: NonNullable<ApifyTiktokItem['authorMeta']>): CompetitorProfile {
  return {
    handle,
    displayName: author.nickName || handle,
    avatarUrl: author.avatar || null,
    bio: author.signature ?? '',
    verified: Boolean(author.verified),
    followers: optionalCount(author.fans),
    following: optionalCount(author.following),
    likes: optionalCount(author.heart),
    videoCount: optionalCount(author.video),
    profileUrl: `https://www.tiktok.com/@${handle}`,
  };
}

function apifyFailureMessage(status: number): string {
  if (status === 401 || status === 403) return 'Apify rejected the API token. Check APIFY_TOKEN.';
  if (status === 402) return 'The Apify account is out of credit for this month.';
  if (status === 408) return 'TikTok took too long to respond. Try again in a minute.';
  if (status === 429) return 'Apify is rate limiting requests. Try again in a minute.';
  return `The TikTok video source failed (HTTP ${status}).`;
}

function count(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function optionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
