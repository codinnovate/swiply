import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { PlatformRegistry } from '../../platforms/platform-registry.service';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  SocialAccount,
  SocialAccountDocument,
} from '../social-accounts/schemas/social-account.schema';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { PostMetric, PostMetricDocument } from './schemas/post-metric.schema';

/** Platform counts move slowly; an hour keeps the dashboard fresh without hammering the API. */
export const METRICS_TTL_MS = 60 * 60 * 1000;
/** Enough history to cover the 90-day range for an account posting daily. */
const MAX_POSTS_PER_ACCOUNT = 100;
const TOP_POSTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MetricTotals {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface AnalyticsOverview {
  days: number;
  totals: MetricTotals;
  /** One entry per UTC day in the range, oldest first, counted by publish date. */
  daily: Array<MetricTotals & { date: string }>;
  topPosts: Array<{
    id: string;
    platform: string;
    accountName: string;
    title: string | null;
    postedAt: Date;
    coverImageUrl: string | null;
    shareUrl: string | null;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    viaSwiply: boolean;
  }>;
  accounts: Array<{
    id: string;
    platform: string;
    displayName: string;
    lastSyncedAt: Date | null;
    syncError: string | null;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(PostMetric.name) private readonly metricModel: Model<PostMetricDocument>,
    @InjectModel(SocialAccount.name) private readonly accountModel: Model<SocialAccountDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly socialAccounts: SocialAccountsService,
    private readonly registry: PlatformRegistry,
  ) {}

  async overview(workspaceId: string, days: number, now = new Date()): Promise<AnalyticsOverview> {
    const workspace = new Types.ObjectId(workspaceId);
    const accounts = (
      await this.accountModel
        .find({ workspaceId: workspace, status: 'active', connectionProvider: { $in: ['direct', null] } })
        .exec()
    ).filter((account) => this.supportsMetrics(account.platform));

    const syncs = await Promise.all(accounts.map((account) => this.syncIfStale(workspaceId, account, now)));

    const end = startOfUtcDay(now);
    const since = new Date(end.getTime() - (days - 1) * DAY_MS);
    const metrics = await this.metricModel
      .find({ workspaceId: workspace, socialAccountId: { $in: accounts.map((a) => a._id) }, postedAt: { $gte: since } })
      .exec();

    const daily = Array.from({ length: days }, (_, i) => ({
      date: new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10),
      ...emptyTotals(),
    }));
    const totals = emptyTotals();
    for (const metric of metrics) {
      const bucket = daily[Math.floor((startOfUtcDay(metric.postedAt).getTime() - since.getTime()) / DAY_MS)];
      for (const target of bucket ? [totals, bucket] : [totals]) add(target, metric);
    }

    const top = [...metrics].sort((a, b) => b.views - a.views || b.likes - a.likes).slice(0, TOP_POSTS);
    const published = new Set(
      (
        await this.postModel
          .find({ workspaceId: workspace, platformPostId: { $in: top.map((m) => m.platformPostId) } })
          .select('platformPostId')
          .exec()
      ).map((post) => post.platformPostId),
    );
    const names = new Map(accounts.map((a) => [String(a._id), a.displayName]));

    return {
      days,
      totals,
      daily,
      topPosts: top.map((metric) => ({
        id: String(metric._id),
        platform: metric.platform,
        accountName: names.get(String(metric.socialAccountId)) ?? '',
        title: metric.title,
        postedAt: metric.postedAt,
        coverImageUrl: metric.coverImageUrl,
        shareUrl: metric.shareUrl,
        views: metric.views,
        likes: metric.likes,
        comments: metric.comments,
        shares: metric.shares,
        viaSwiply: published.has(metric.platformPostId),
      })),
      accounts: accounts.map((account, i) => ({
        id: String(account._id),
        platform: account.platform,
        displayName: account.displayName,
        ...syncs[i],
      })),
    };
  }

  private supportsMetrics(platform: string): boolean {
    try {
      return typeof this.registry.get(platform).fetchPostMetrics === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Refreshes one account's cached counts when they are older than the TTL.
   * A platform failure keeps the last good numbers and is reported, not thrown,
   * so one broken account can't blank the whole dashboard.
   */
  private async syncIfStale(
    workspaceId: string,
    account: SocialAccountDocument,
    now: Date,
  ): Promise<{ lastSyncedAt: Date | null; syncError: string | null }> {
    const latest = await this.metricModel
      .findOne({ socialAccountId: account._id })
      .sort({ fetchedAt: -1 })
      .select('fetchedAt')
      .exec();
    const lastSyncedAt = latest?.fetchedAt ?? null;
    if (lastSyncedAt && now.getTime() - lastSyncedAt.getTime() < METRICS_TTL_MS) {
      return { lastSyncedAt, syncError: null };
    }

    try {
      const token = await this.socialAccounts.getUsableAccessToken(workspaceId, String(account._id));
      const posts = await this.registry.get(account.platform).fetchPostMetrics!(token, MAX_POSTS_PER_ACCOUNT);
      const fetchedAt = now;
      if (posts.length) {
        await this.metricModel.bulkWrite(
          posts.map((post) => ({
            updateOne: {
              filter: { socialAccountId: account._id, platformPostId: post.platformPostId },
              update: { $set: { ...post, workspaceId: account.workspaceId, platform: account.platform, fetchedAt } },
              upsert: true,
            },
          })),
        );
      }
      return { lastSyncedAt: posts.length ? fetchedAt : lastSyncedAt, syncError: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load post analytics';
      this.logger.warn(`Post metrics sync failed for ${account.platform} account ${String(account._id)}: ${message}`);
      return { lastSyncedAt, syncError: message };
    }
  }
}

function emptyTotals(): MetricTotals {
  return { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 };
}

function add(target: MetricTotals, metric: Pick<PostMetric, 'views' | 'likes' | 'comments' | 'shares'>): void {
  target.posts += 1;
  target.views += metric.views;
  target.likes += metric.likes;
  target.comments += metric.comments;
  target.shares += metric.shares;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
