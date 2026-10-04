import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

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
  it('follows the bottom cursor for extra pages, de-duplicating overlapping results', async () => {
    const page = (ids: string[], bottom?: string) =>
      of({
        data: {
          code: 200,
          results: ids.map((id) => ({
            id,
            created_timestamp: 1_790_000_000 - Number(id),
            author: { screen_name: 'sam' },
          })),
          cursor: bottom ? { bottom } : undefined,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse);
    const get = jest
      .fn()
      .mockReturnValueOnce(page(['1', '2'], 'c1'))
      .mockReturnValueOnce(page(['2', '3'], 'c2'))
      .mockReturnValueOnce(page(['3'], 'c3'))
      .mockReturnValueOnce(page(['4']));
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;
    const provider = new FxTwitterXPostProvider({ get } as unknown as HttpService, config);

    const posts = await provider.listRecentPosts('sam', { pages: 5 });

    // The third page added nothing new, so paging stopped before the fourth.
    expect(posts.map((post) => post.id)).toEqual(['1', '2', '3']);
    expect(get).toHaveBeenCalledTimes(3);
    expect(get.mock.calls[1][0]).toContain('cursor=c1');
  });

  it('keeps earlier pages when a deeper page fails', async () => {
    const first = of({
      data: {
        code: 200,
        results: [{ id: '1', created_timestamp: 1_790_000_000, author: { screen_name: 'sam' } }],
        cursor: { bottom: 'c1' },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as AxiosResponse);
    const get = jest
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(throwError(() => new Error('timeout')));
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;
    const provider = new FxTwitterXPostProvider({ get } as unknown as HttpService, config);

    const posts = await provider.listRecentPosts('sam', { pages: 3 });
    expect(posts.map((post) => post.id)).toEqual(['1']);
  });

  it("records what a reply's parent was answering, from other people's posts in the timeline", async () => {
    const at = 1_790_000_000;
    const get = jest.fn().mockReturnValue(
      of({
        data: {
          code: 200,
          results: [
            { id: '1', created_timestamp: at, author: { screen_name: 'sam' } },
            {
              id: '2',
              created_timestamp: at + 60,
              author: { screen_name: 'ana' },
              replying_to: { screen_name: 'Sam', status: '1' },
            },
            {
              id: '3',
              created_timestamp: at + 120,
              author: { screen_name: 'sam' },
              replying_to: { screen_name: 'ana', status: '2' },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse),
    );
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;
    const provider = new FxTwitterXPostProvider({ get } as unknown as HttpService, config);

    const posts = await provider.listRecentPosts('sam');

    // Ana's reply itself isn't returned; it only explains Sam's answer.
    expect(posts.map((post) => post.id)).toEqual(['3', '1']);
    expect(posts[0].parentReplyTo).toEqual({ username: 'sam', postId: '1' });
    expect(posts[1].parentReplyTo).toBeUndefined();
  });
});
