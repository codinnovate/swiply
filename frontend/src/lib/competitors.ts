// Types and pure helpers for Growth → Competitor analysis. Shapes mirror
// backend/src/modules/competitors/domain/competitor.types.ts.

export type CompetitorNetwork = "tiktok" | "instagram" | "youtube" | "facebook" | "x";

export const competitorNetworks: { id: CompetitorNetwork; label: string; available: boolean }[] = [
  { id: "tiktok", label: "TikTok", available: true },
  { id: "instagram", label: "Instagram", available: false },
  { id: "youtube", label: "YouTube", available: false },
  { id: "facebook", label: "Facebook", available: false },
  { id: "x", label: "X", available: false },
];

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
  engagementRate: number;
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
  bestWeekday: number | null;
  bestHourUtc: number | null;
  firstPostAt: string | null;
  lastPostAt: string | null;
}

export interface PerformancePoint {
  weekStart: string;
  videos: number;
  views: number;
  engagementRate: number;
}

export type SourceState = "ok" | "empty" | "not_configured" | "failed";
export interface SourceStatus {
  state: SourceState;
  message?: string;
}

export interface CompetitorReport {
  id: string;
  cached: boolean;
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

export interface CompetitorListItem {
  id: string;
  network: CompetitorNetwork;
  company: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number | null;
  videosAnalyzed: number;
  adsFound: number;
  fetchedAt: string;
}

export interface CompetitorSourceAvailability {
  network: CompetitorNetwork;
  videos: boolean;
  ads: boolean;
}

export type VideoSort = "latest" | "views" | "engagement";
export type HashtagSort = "uses" | "avgViews" | "engagement";

/** Mirrors the backend's handle guess so the form can preview it. */
export function guessHandle(company: string, handle = ""): string | null {
  const source = handle.trim() || company.trim();
  const fromUrl = source.match(/tiktok\.com\/@([^/?#\s]+)/i)?.[1];
  const candidate = (fromUrl ?? source).replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "");
  return /^[a-z0-9._]{2,24}$/.test(candidate) ? candidate : null;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(rate >= 0.1 ? 1 : 2)}%`;
}

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatWeekday(day: number | null): string {
  return day === null ? "-" : weekdays[day] ?? "-";
}

/** Converts the report's best UTC hour to the viewer's clock, e.g. "6 PM". */
export function formatHourUtc(hour: number | null, reference = new Date()): string {
  if (hour === null) return "-";
  const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), hour));
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

export function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

export function sortVideos(videos: CompetitorVideo[], sort: VideoSort): CompetitorVideo[] {
  const sorted = [...videos];
  if (sort === "views") return sorted.sort((a, b) => b.views - a.views);
  if (sort === "engagement") return sorted.sort((a, b) => b.engagementRate - a.engagementRate);
  return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function filterVideos(
  videos: CompetitorVideo[],
  { hashtag, promotedOnly }: { hashtag?: string | null; promotedOnly?: boolean },
): CompetitorVideo[] {
  return videos.filter(
    (video) => (!hashtag || video.hashtags.includes(hashtag)) && (!promotedOnly || video.isPromoted),
  );
}

export function sortHashtags(hashtags: HashtagStat[], sort: HashtagSort): HashtagStat[] {
  const sorted = [...hashtags];
  if (sort === "avgViews") return sorted.sort((a, b) => b.avgViews - a.avgViews || b.uses - a.uses);
  if (sort === "engagement") return sorted.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate || b.uses - a.uses);
  return sorted.sort((a, b) => b.uses - a.uses || b.avgViews - a.avgViews);
}

/** How a video did against the account's own median: "2.4×" above or below typical. */
export function performanceVsMedian(views: number, median: number): { label: string; tone: "up" | "down" | "flat" } {
  if (!median) return { label: "-", tone: "flat" };
  const ratio = views / median;
  if (ratio >= 1.5) return { label: `${ratio.toFixed(1)}× median`, tone: "up" };
  if (ratio <= 0.5) return { label: `${ratio.toFixed(1)}× median`, tone: "down" };
  return { label: "Typical", tone: "flat" };
}
