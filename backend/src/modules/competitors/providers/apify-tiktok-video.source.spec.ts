import type { ConfigService } from '@nestjs/config';

import { CompetitorProfileNotFoundError } from '../domain/competitor.types';
import { ApifyTiktokVideoSource, parseApifyTiktokItems, type ApifyTiktokItem } from './apify-tiktok-video.source';

const author = {
  name: 'gymshark',
  nickName: 'Gymshark',
  verified: true,
  signature: 'Be a visionary.',
  avatar: 'https://cdn.example.com/avatar.jpg',
  fans: 5_400_000,
  following: 120,
  heart: 98_000_000,
  video: 2100,
};

const item = (id: string, extra: Partial<ApifyTiktokItem> = {}): ApifyTiktokItem => ({
  id,
  text: 'Leg day 🦵 #gym #GymTok',
  createTimeISO: '2026-09-20T17:30:00.000Z',
  webVideoUrl: `https://www.tiktok.com/@gymshark/video/${id}`,
  playCount: 10_000,
  diggCount: 800,
  commentCount: 100,
  shareCount: 50,
  collectCount: '50',
  hashtags: [{ name: 'gym' }, { name: 'gymtok' }],
  videoMeta: { duration: 21, coverUrl: `https://cdn.example.com/${id}.jpg` },
  musicMeta: { musicName: 'original sound', musicAuthor: 'Gymshark' },
  authorMeta: author,
  ...extra,
});

function config(values: Record<string, unknown>): ConfigService {
  return { get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback) } as unknown as ConfigService;
}

describe('parseApifyTiktokItems', () => {
  it('maps profile and video metrics, newest first', () => {
    const result = parseApifyTiktokItems('gymshark', [
      item('1', { createTimeISO: '2026-09-01T00:00:00.000Z' }),
      item('2', { isAd: true, isPinned: true }),
    ]);
    expect(result.profile).toEqual({
      handle: 'gymshark',
      displayName: 'Gymshark',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      bio: 'Be a visionary.',
      verified: true,
      followers: 5_400_000,
      following: 120,
      likes: 98_000_000,
      videoCount: 2100,
      profileUrl: 'https://www.tiktok.com/@gymshark',
    });
    expect(result.videos.map((video) => video.id)).toEqual(['2', '1']);
    expect(result.videos[0]).toEqual({
      id: '2',
      url: 'https://www.tiktok.com/@gymshark/video/2',
      caption: 'Leg day 🦵 #gym #GymTok',
      hashtags: ['gym', 'gymtok'],
      coverUrl: 'https://cdn.example.com/2.jpg',
      durationSeconds: 21,
      createdAt: '2026-09-20T17:30:00.000Z',
      views: 10_000,
      likes: 800,
      comments: 100,
      shares: 50,
      saves: 50,
      engagementRate: 0.1,
      isPromoted: true,
      isPinned: true,
      music: 'original sound — Gymshark',
    });
  });

  it('drops error rows, duplicates and posts by other authors', () => {
    const result = parseApifyTiktokItems('gymshark', [
      item('1'),
      item('1'),
      { error: 'Rate limited', id: '9' },
      item('3', { authorMeta: { ...author, name: 'someone_else' } }),
      item('4', { createTimeISO: undefined, createTime: 1_790_000_000, authorMeta: undefined }),
    ]);
    // createTime 1_790_000_000 is 2026-09-22, newer than item 1.
    expect(result.videos.map((video) => video.id)).toEqual(['4', '1']);
    expect(result.videos[0].createdAt).toBe(new Date(1_790_000_000 * 1000).toISOString());
  });

  it('throws a not-found error when no videos remain', () => {
    expect(() => parseApifyTiktokItems('ghost', [{ error: 'User not found' }])).toThrow(CompetitorProfileNotFoundError);
  });
});

describe('ApifyTiktokVideoSource', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is configured only with a token', () => {
    expect(new ApifyTiktokVideoSource(config({})).isConfigured()).toBe(false);
    expect(new ApifyTiktokVideoSource(config({ 'research.apifyToken': 'apify_api_x' })).isConfigured()).toBe(true);
  });

  it('runs the actor synchronously for the handle without putting the token in the URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([item('1')]), { status: 200 }));
    const source = new ApifyTiktokVideoSource(config({ 'research.apifyToken': 'apify_api_x' }));

    const result = await source.fetchProfileVideos('gymshark', 30);

    expect(result.videos).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?timeout=150&clean=true',
    );
    expect(init.headers).toMatchObject({ Authorization: 'Bearer apify_api_x' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      profiles: ['gymshark'],
      resultsPerPage: 30,
      profileSorting: 'latest',
      shouldDownloadVideos: false,
    });
  });

  it.each([
    [401, 'Apify rejected the API token. Check APIFY_TOKEN.'],
    [402, 'The Apify account is out of credit for this month.'],
    [500, 'The TikTok video source failed (HTTP 500).'],
  ])('explains an HTTP %i failure', async (status, message) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status }));
    const source = new ApifyTiktokVideoSource(config({ 'research.apifyToken': 't' }));
    await expect(source.fetchProfileVideos('gymshark', 10)).rejects.toThrow(message);
  });
});
