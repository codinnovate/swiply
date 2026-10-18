import type { ConfigService } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Model, Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { CompetitorsService, REPORT_CACHE_MS } from './competitors.service';
import {
  CompetitorProfileNotFoundError,
  type CompetitorAd,
  type CompetitorAdSource,
  type CompetitorVideoSource,
  type ProfileVideos,
} from './domain/competitor.types';
import { ResearchCompetitorDto } from './dto/research-competitor.dto';
import { CompetitorReport, CompetitorReportDocument, CompetitorReportSchema } from './schemas/competitor-report.schema';

const workspaceId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();
const now = new Date('2026-09-28T12:00:00.000Z');

const profileVideos: ProfileVideos = {
  profile: {
    handle: 'gymshark',
    displayName: 'Gymshark',
    avatarUrl: null,
    bio: '',
    verified: true,
    followers: 5_000_000,
    following: 10,
    likes: 1,
    videoCount: 2,
    profileUrl: 'https://www.tiktok.com/@gymshark',
  },
  videos: [
    {
      id: '1',
      url: 'https://www.tiktok.com/@gymshark/video/1',
      caption: '#gym',
      hashtags: ['gym'],
      coverUrl: null,
      durationSeconds: 10,
      createdAt: '2026-09-20T10:00:00.000Z',
      views: 1000,
      likes: 100,
      comments: 0,
      shares: 0,
      saves: 0,
      engagementRate: 0.1,
      isPromoted: true,
      isPinned: false,
      music: null,
    },
  ],
};

const ownAd: CompetitorAd = {
  id: '55',
  advertiserName: 'Gymshark Ltd',
  paidFor: null,
  firstShownAt: '2026-09-01',
  lastShownAt: '2026-09-20',
  status: 'active',
  reach: '10K-100K',
  videoUrls: [],
  imageUrls: [],
  libraryUrl: 'https://library.tiktok.com/ads/detail/?ad_id=55',
};

function dto(values: Partial<ResearchCompetitorDto>): ResearchCompetitorDto {
  return Object.assign(new ResearchCompetitorDto(), values);
}

describe('CompetitorsService', () => {
  let server: MongoMemoryServer;
  let connection: mongoose.Connection;
  let model: Model<CompetitorReportDocument>;
  let videoSource: jest.Mocked<CompetitorVideoSource>;
  let adSource: jest.Mocked<CompetitorAdSource>;
  let service: CompetitorsService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(server.getUri('competitors-test')).asPromise();
    model = connection.model(CompetitorReport.name, CompetitorReportSchema) as unknown as Model<CompetitorReportDocument>;
    await model.init();
  });

  afterAll(async () => {
    await connection.close();
    await server.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
    videoSource = { isConfigured: jest.fn().mockReturnValue(true), fetchProfileVideos: jest.fn().mockResolvedValue(profileVideos) };
    adSource = { isConfigured: jest.fn().mockReturnValue(true), searchAds: jest.fn().mockResolvedValue([ownAd]) };
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;
    service = new CompetitorsService(model, videoSource, adSource, config);
  });

  async function rejection(promise: Promise<unknown>): Promise<ApiException> {
    const error = await promise.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiException);
    return error as ApiException;
  }

  it('builds, stores and lists a report from both sources', async () => {
    const report = await service.research(workspaceId, userId, dto({ company: 'Gymshark' }), now);

    expect(videoSource.fetchProfileVideos).toHaveBeenCalledWith('gymshark', 40);
    expect(adSource.searchAds).toHaveBeenCalledWith('Gymshark');
    expect(report).toMatchObject({
      cached: false,
      network: 'tiktok',
      company: 'Gymshark',
      handle: 'gymshark',
      summary: { videosAnalyzed: 1, totalViews: 1000, promotedCount: 1, topHashtag: 'gym' },
      hashtags: [{ tag: 'gym', uses: 1 }],
      ads: [{ id: '55' }],
      performance: [{ weekStart: '2026-09-14', videos: 1, views: 1000 }],
      sources: { videos: { state: 'ok' }, ads: { state: 'ok' } },
      fetchedAt: now.toISOString(),
    });

    await expect(service.list(workspaceId)).resolves.toEqual([
      {
        id: report.id,
        network: 'tiktok',
        company: 'Gymshark',
        handle: 'gymshark',
        displayName: 'Gymshark',
        avatarUrl: null,
        followers: 5_000_000,
        videosAnalyzed: 1,
        adsFound: 1,
        fetchedAt: now.toISOString(),
      },
    ]);
    await expect(service.get(workspaceId, report.id)).resolves.toMatchObject({ id: report.id, cached: true });
  });

  it('serves a fresh report from cache and refetches once stale or on refresh', async () => {
    await service.research(workspaceId, userId, dto({ company: 'Gymshark' }), now);
    const cached = await service.research(workspaceId, userId, dto({ company: 'gymshark' }), new Date(now.getTime() + 60_000));
    expect(cached.cached).toBe(true);
    expect(videoSource.fetchProfileVideos).toHaveBeenCalledTimes(1);

    await service.research(workspaceId, userId, dto({ company: 'Gymshark', refresh: true }), new Date(now.getTime() + 60_000));
    const stale = await service.research(workspaceId, userId, dto({ company: 'Gymshark' }), new Date(now.getTime() + REPORT_CACHE_MS + 120_000));
    expect(stale.cached).toBe(false);
    expect(videoSource.fetchProfileVideos).toHaveBeenCalledTimes(3);
    await expect(model.countDocuments()).resolves.toBe(1);
  });

  it('keeps each workspace’s reports private', async () => {
    const report = await service.research(workspaceId, userId, dto({ company: 'Gymshark' }), now);
    const other = new Types.ObjectId().toString();
    await expect(service.list(other)).resolves.toEqual([]);
    expect((await rejection(service.get(other, report.id))).code).toBe('NOT_FOUND');
    expect((await rejection(service.remove(other, report.id))).code).toBe('NOT_FOUND');
    await service.remove(workspaceId, report.id);
    await expect(service.list(workspaceId)).resolves.toEqual([]);
  });

  it('uses the handle as the ad search term when a handle or URL is typed as the company', async () => {
    const report = await service.research(workspaceId, userId, dto({ company: '@GymShark' }), now);
    expect(adSource.searchAds).toHaveBeenCalledWith('gymshark');
    expect(report.company).toBe('Gymshark');
  });

  it('returns a partial report when one source is unconfigured or fails', async () => {
    adSource.isConfigured.mockReturnValue(false);
    const withoutAds = await service.research(workspaceId, userId, dto({ company: 'Gymshark' }), now);
    expect(adSource.searchAds).not.toHaveBeenCalled();
    expect(withoutAds.sources).toEqual({ videos: { state: 'ok' }, ads: { state: 'not_configured' } });

    adSource.isConfigured.mockReturnValue(true);
    videoSource.fetchProfileVideos.mockRejectedValue(new Error('The Apify account is out of credit for this month.'));
    const adsOnly = await service.research(workspaceId, userId, dto({ company: 'Gymshark', refresh: true }), now);
    expect(adsOnly.sources.videos).toEqual({ state: 'failed', message: 'The Apify account is out of credit for this month.' });
    expect(adsOnly.ads).toHaveLength(1);
    expect(adsOnly.videos).toEqual([]);
  });

  it('rejects unsupported networks, unusable names and missing configuration', async () => {
    expect((await rejection(service.research(workspaceId, userId, dto({ company: 'Nike', network: 'instagram' })))).code).toBe(
      'COMPETITOR_NETWORK_UNSUPPORTED',
    );
    expect((await rejection(service.research(workspaceId, userId, dto({ company: '!!' })))).code).toBe('COMPETITOR_HANDLE_INVALID');

    videoSource.isConfigured.mockReturnValue(false);
    adSource.isConfigured.mockReturnValue(false);
    const error = await rejection(service.research(workspaceId, userId, dto({ company: 'Nike' })));
    expect(error.code).toBe('COMPETITOR_RESEARCH_NOT_CONFIGURED');
    expect(error.getStatus()).toBe(503);
  });

  it('reports a missing profile when there are no ads to show either', async () => {
    videoSource.fetchProfileVideos.mockRejectedValue(new CompetitorProfileNotFoundError('ghostbrand'));
    adSource.searchAds.mockResolvedValue([]);
    const error = await rejection(service.research(workspaceId, userId, dto({ company: 'Ghost Brand' })));
    expect(error.code).toBe('COMPETITOR_PROFILE_NOT_FOUND');
    expect(error.getStatus()).toBe(404);
    await expect(model.countDocuments()).resolves.toBe(0);
  });

  it('fails with the source message when every source errors', async () => {
    videoSource.fetchProfileVideos.mockRejectedValue(new Error('Apify rejected the API token. Check APIFY_TOKEN.'));
    adSource.searchAds.mockRejectedValue(new Error('Scope not authorized'));
    const error = await rejection(service.research(workspaceId, userId, dto({ company: 'Nike' })));
    expect(error.code).toBe('COMPETITOR_RESEARCH_FAILED');
    expect(error.getResponse()).toMatchObject({
      error: { message: 'Apify rejected the API token. Check APIFY_TOKEN.', details: { ads: { state: 'failed' } } },
    });
    expect(error.getStatus()).toBe(502);
  });

  it('lists sources the server can use', () => {
    adSource.isConfigured.mockReturnValue(false);
    expect(service.sources()).toEqual([{ network: 'tiktok', videos: true, ads: false }]);
  });
});
