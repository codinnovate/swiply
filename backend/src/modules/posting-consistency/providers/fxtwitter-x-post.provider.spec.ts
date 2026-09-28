import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';

import { FxTwitterXPostProvider } from './fxtwitter-x-post.provider';

describe('FxTwitterXPostProvider', () => {
  it('maps the public API profile into the POSTLOCK domain model', async () => {
    const response = {
      data: {
        code: 200,
        user: {
          id: '44196397',
          screen_name: 'ElonMusk',
          name: 'Elon Musk',
          avatar_url: 'https://pbs.twimg.com/profile_images/example_normal.jpg',
          protected: false,
          verification: { verified: true, type: 'individual' },
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as AxiosResponse;
    const http = { get: jest.fn().mockReturnValue(of(response)) } as unknown as HttpService;
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;
    const provider = new FxTwitterXPostProvider(http, config);

    await expect(provider.getProfile('elonmusk')).resolves.toEqual({
      providerUserId: '44196397',
      username: 'elonmusk',
      displayName: 'Elon Musk',
      avatarUrl: 'https://pbs.twimg.com/profile_images/example_400x400.jpg',
      isPublic: true,
      isVerified: true,
      verificationType: 'individual',
    });
    expect(http.get).toHaveBeenCalledWith(
      'https://api.fxtwitter.com/2/profile/elonmusk',
      expect.objectContaining({ timeout: 8_000 }),
    );
  });

  it("keeps only the account's own posts and maps content features and metrics", async () => {
    const status = (id: string, extra: object) => ({
      id,
      created_timestamp: 1_790_000_000,
      author: { screen_name: 'Sam' },
      likes: 3,
      replies: 2,
      reposts: 1,
      quotes: 0,
      bookmarks: 4,
      views: 900,
      ...extra,
    });
    const response = {
      data: {
        code: 200,
        results: [
          status('1', {
            text: 'Launch day',
            media: { all: [{ type: 'photo' }, { type: 'video' }] },
            raw_text: {
              facets: [
                { type: 'hashtag' },
                { type: 'url', replacement: 'https://x.com/other/status/5' },
              ],
            },
          }),
          status('2', {
            text: '@other nice',
            replying_to: { screen_name: 'Other', status: '9' },
            raw_text: { facets: [{ type: 'url', replacement: 'https://example.com' }] },
          }),
          status('3', { author: { screen_name: 'other' }, text: 'not mine' }),
          status('4', { author: { screen_name: 'other' }, reposted_by: { screen_name: 'sam' } }),
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as AxiosResponse;
    const http = { get: jest.fn().mockReturnValue(of(response)) } as unknown as HttpService;
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;

    const posts = await new FxTwitterXPostProvider(http, config).listRecentPosts('sam');

    expect(posts.map((post) => [post.id, post.kind])).toEqual([
      ['1', 'original'],
      ['2', 'reply'],
      ['4', 'repost'],
    ]);
    expect(posts[0]).toMatchObject({
      mediaType: 'video',
      hashtagCount: 1,
      hasExternalLink: false,
      engagement: { likes: 3, replies: 2, reposts: 1, quotes: 0, bookmarks: 4, views: 900 },
    });
    expect(posts[1]).toMatchObject({
      replyToUsername: 'other',
      replyToPostId: '9',
      hasExternalLink: true,
    });
  });
});
