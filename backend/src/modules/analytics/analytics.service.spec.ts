import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Model, Types } from 'mongoose';

import type { PostMetricsInput } from '../../platforms/platform-adapter.interface';
import type { PlatformRegistry } from '../../platforms/platform-registry.service';
import { Post, PostDocument, PostSchema } from '../posts/schemas/post.schema';
import {
  SocialAccount,
  SocialAccountDocument,
  SocialAccountSchema,
} from '../social-accounts/schemas/social-account.schema';
import type { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { AnalyticsService, METRICS_TTL_MS } from './analytics.service';
import { PostMetric, PostMetricDocument, PostMetricSchema } from './schemas/post-metric.schema';

const now = new Date('2026-10-02T15:00:00Z');
const workspaceId = new Types.ObjectId();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

function video(id: string, postedAt: Date, views: number, likes: number): PostMetricsInput {
  return { platformPostId: id, title: `Video ${id}`, postedAt, coverImageUrl: null, shareUrl: null, views, likes, comments: 1, shares: 1 };
}

describe('AnalyticsService', () => {
  let server: MongoMemoryServer;
  let connection: mongoose.Connection;
  let metrics: Model<PostMetricDocument>;
  let accounts: Model<SocialAccountDocument>;
  let posts: Model<PostDocument>;
  let fetchPostMetrics: jest.Mock<Promise<PostMetricsInput[]>, [string, number]>;
  let getUsableAccessToken: jest.Mock;
  let service: AnalyticsService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(server.getUri('analytics-test')).asPromise();
    metrics = connection.model(PostMetric.name, PostMetricSchema) as unknown as Model<PostMetricDocument>;
    accounts = connection.model(SocialAccount.name, SocialAccountSchema) as unknown as Model<SocialAccountDocument>;
    posts = connection.model(Post.name, PostSchema) as unknown as Model<PostDocument>;
    await metrics.init();
  });

  afterAll(async () => {
    await connection.close();
    await server.stop();
  });

  beforeEach(async () => {
    await Promise.all([metrics.deleteMany({}), accounts.deleteMany({}), posts.deleteMany({})]);
    fetchPostMetrics = jest.fn().mockResolvedValue([]);
    getUsableAccessToken = jest.fn().mockResolvedValue('access-token');
    const registry = {
      get: (platform: string) => (platform === 'tiktok' ? { fetchPostMetrics } : {}),
    } as unknown as PlatformRegistry;
    service = new AnalyticsService(
      metrics,
      accounts,
      posts,
      { getUsableAccessToken } as unknown as SocialAccountsService,
      registry,
    );
  });

  async function account(overrides: Partial<SocialAccount> = {}) {
    return accounts.create({
      workspaceId,
      platform: 'tiktok',
      platformAccountId: new Types.ObjectId().toString(),
      displayName: 'Creator',
      connectedByUserId: new Types.ObjectId(),
      ...overrides,
    });
  }

  it('totals views and likes by publish day and ranks the top posts', async () => {
    const tiktok = await account();
    fetchPostMetrics.mockResolvedValue([
      video('a', daysAgo(0), 500, 40),
      video('b', daysAgo(0), 300, 10),
      video('c', daysAgo(2), 2000, 90),
      video('old', daysAgo(30), 9999, 999),
    ]);
    await posts.collection.insertOne({ workspaceId, platformPostId: 'c' });

    const overview = await service.overview(String(workspaceId), 7, now);

    expect(getUsableAccessToken).toHaveBeenCalledWith(String(workspaceId), String(tiktok._id));
    expect(fetchPostMetrics).toHaveBeenCalledWith('access-token', 100);
    expect(overview.totals).toEqual({ posts: 3, views: 2800, likes: 140, comments: 3, shares: 3 });
    expect(overview.daily).toHaveLength(7);
    expect(overview.daily[0].date).toBe('2026-09-26');
    expect(overview.daily[6]).toMatchObject({ date: '2026-10-02', posts: 2, views: 800, likes: 50 });
    expect(overview.daily[4]).toMatchObject({ date: '2026-09-30', posts: 1, views: 2000, likes: 90 });
    expect(overview.daily[1]).toMatchObject({ posts: 0, views: 0, likes: 0 });
    expect(overview.topPosts.map((p) => [p.title, p.viaSwiply, p.accountName])).toEqual([
      ['Video c', true, 'Creator'],
      ['Video a', false, 'Creator'],
      ['Video b', false, 'Creator'],
    ]);
    expect(overview.accounts).toEqual([
      { id: String(tiktok._id), platform: 'tiktok', displayName: 'Creator', lastSyncedAt: now, syncError: null },
    ]);
  });

  it('serves cached numbers inside the TTL and refreshes them after it', async () => {
    await account();
    fetchPostMetrics.mockResolvedValue([video('a', daysAgo(1), 100, 5)]);
    await service.overview(String(workspaceId), 7, now);

    fetchPostMetrics.mockResolvedValue([video('a', daysAgo(1), 250, 9)]);
    const cached = await service.overview(String(workspaceId), 7, new Date(now.getTime() + METRICS_TTL_MS - 1));
    expect(fetchPostMetrics).toHaveBeenCalledTimes(1);
    expect(cached.totals.views).toBe(100);

    const refreshed = await service.overview(String(workspaceId), 7, new Date(now.getTime() + METRICS_TTL_MS));
    expect(fetchPostMetrics).toHaveBeenCalledTimes(2);
    expect(refreshed.totals).toMatchObject({ posts: 1, views: 250, likes: 9 });
  });

  it('keeps the last good numbers and reports the error when a sync fails', async () => {
    await account();
    fetchPostMetrics.mockResolvedValue([video('a', daysAgo(1), 100, 5)]);
    await service.overview(String(workspaceId), 7, now);

    fetchPostMetrics.mockRejectedValue(new Error('TikTok said no'));
    const later = new Date(now.getTime() + METRICS_TTL_MS);
    const overview = await service.overview(String(workspaceId), 7, later);

    expect(overview.totals.views).toBe(100);
    expect(overview.accounts[0]).toMatchObject({ lastSyncedAt: now, syncError: 'TikTok said no' });
  });

  it('only reads active, directly connected accounts on platforms with analytics, in this workspace', async () => {
    await account({ status: 'expired' });
    await account({ connectionProvider: 'buffer' });
    await account({ platform: 'pinterest' });
    await account({ workspaceId: new Types.ObjectId() });

    const overview = await service.overview(String(workspaceId), 30, now);

    expect(fetchPostMetrics).not.toHaveBeenCalled();
    expect(overview.accounts).toEqual([]);
    expect(overview.daily).toHaveLength(30);
    expect(overview.totals.posts).toBe(0);
  });
});
