import type {
  CompetitorAd,
  CompetitorSummary,
  CompetitorVideo,
  HashtagStat,
  PerformancePoint,
} from './competitor.types';

const HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Turns what the user typed into a TikTok username. An explicit handle or a
 * profile URL wins; otherwise the company name is squashed into the handle most
 * brands use ("Blue Apron" → "blueapron"). Returns null when nothing usable is
 * left.
 */
export function resolveTiktokHandle(company: string, handle?: string | null): string | null {
  const source = handle?.trim() || company.trim();
  const fromUrl = source.match(/tiktok\.com\/@([^/?#\s]+)/i)?.[1];
  const candidate = (fromUrl ?? source)
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');
  return HANDLE_PATTERN.test(candidate) ? candidate : null;
}

/** Hashtags from the provider plus any written inline in the caption, lowercased and deduped. */
export function extractHashtags(caption: string, provided: string[] = []): string[] {
  const inline = Array.from(caption.matchAll(/#([\p{L}\p{N}_]+)/gu), (match) => match[1]);
  const tags = [...provided, ...inline]
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

export function engagementRate(video: Pick<CompetitorVideo, 'views' | 'likes' | 'comments' | 'shares' | 'saves'>): number {
  if (!video.views) return 0;
  return round((video.likes + video.comments + video.shares + video.saves) / video.views, 4);
}

export function hashtagStats(videos: CompetitorVideo[]): HashtagStat[] {
  const byTag = new Map<string, CompetitorVideo[]>();
  for (const video of videos) {
    for (const tag of video.hashtags) {
      const list = byTag.get(tag) ?? [];
      list.push(video);
      byTag.set(tag, list);
    }
  }
  return Array.from(byTag, ([tag, list]) => {
    const totalViews = sum(list.map((video) => video.views));
    return {
      tag,
      uses: list.length,
      totalViews,
      avgViews: Math.round(totalViews / list.length),
      avgEngagementRate: round(mean(list.map((video) => video.engagementRate)), 4),
      lastUsedAt: list.map((video) => video.createdAt).sort().at(-1) as string,
    };
  }).sort((a, b) => b.uses - a.uses || b.avgViews - a.avgViews || a.tag.localeCompare(b.tag));
}

export function summarize(videos: CompetitorVideo[], hashtags: HashtagStat[]): CompetitorSummary {
  const views = videos.map((video) => video.views);
  const dates = videos.map((video) => Date.parse(video.createdAt)).filter(Number.isFinite).sort((a, b) => a - b);
  const first = dates[0];
  const last = dates.at(-1);
  // A single week is the floor so three posts in two days doesn't read as "10/week".
  const weeks = first !== undefined && last !== undefined ? Math.max(1, (last - first) / WEEK_MS) : 1;
  return {
    videosAnalyzed: videos.length,
    totalViews: sum(views),
    avgViews: Math.round(mean(views)),
    medianViews: Math.round(median(views)),
    avgEngagementRate: round(mean(videos.map((video) => video.engagementRate)), 4),
    postsPerWeek: videos.length ? round(videos.length / weeks, 1) : 0,
    promotedCount: videos.filter((video) => video.isPromoted).length,
    topHashtag: hashtags[0]?.tag ?? null,
    bestWeekday: bestBucket(videos, (date) => date.getUTCDay()),
    bestHourUtc: bestBucket(videos, (date) => date.getUTCHours()),
    firstPostAt: first !== undefined ? new Date(first).toISOString() : null,
    lastPostAt: last !== undefined ? new Date(last).toISOString() : null,
  };
}

/** Views and engagement per UTC week (weeks start Monday), oldest first. */
export function weeklyPerformance(videos: CompetitorVideo[]): PerformancePoint[] {
  const weeks = new Map<string, CompetitorVideo[]>();
  for (const video of videos) {
    const date = new Date(video.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = weekStart(date);
    weeks.set(key, [...(weeks.get(key) ?? []), video]);
  }
  return Array.from(weeks, ([start, list]) => ({
    weekStart: start,
    videos: list.length,
    views: sum(list.map((video) => video.views)),
    engagementRate: round(mean(list.map((video) => video.engagementRate)), 4),
  })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Ad Library search is full-text, so it also returns ads that merely mention
 * the company. Keep the company's own ads when any advertiser name matches;
 * otherwise fall back to everything so the user still sees the mentions.
 */
export function rankAdsForCompany(ads: CompetitorAd[], company: string): CompetitorAd[] {
  const needle = squash(company);
  const own = needle ? ads.filter((ad) => squash(ad.advertiserName).includes(needle) || squash(ad.paidFor ?? '').includes(needle)) : [];
  const chosen = own.length ? own : ads;
  return [...chosen].sort((a, b) => (b.lastShownAt ?? '').localeCompare(a.lastShownAt ?? ''));
}

function weekStart(date: Date): string {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function bestBucket(videos: CompetitorVideo[], bucketOf: (date: Date) => number): number | null {
  const buckets = new Map<number, number[]>();
  for (const video of videos) {
    const date = new Date(video.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = bucketOf(date);
    buckets.set(key, [...(buckets.get(key) ?? []), video.views]);
  }
  let best: number | null = null;
  let bestAverage = -1;
  for (const [key, views] of buckets) {
    const average = mean(views);
    if (average > bestAverage || (average === bestAverage && best !== null && key < best)) {
      best = key;
      bestAverage = average;
    }
  }
  return best;
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
