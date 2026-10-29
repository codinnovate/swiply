import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import nock from 'nock';

import { ApiException, ApiErrorBody } from '../../common/errors/api.exception';
import { TikTokAdapter } from './tiktok.adapter';

const CONFIG = {
  'platforms.tiktok.clientKey': 'test-client-key',
  'platforms.tiktok.clientSecret': 'test-client-secret',
};

function adapterWith(config: Record<string, string | undefined>): TikTokAdapter {
  // No axios instance passed: HttpService defaults to the global one, which is
  // what nock intercepts.
  return new TikTokAdapter(new HttpService(), {
    get: (key: string) => config[key],
  } as unknown as ConfigService);
}

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return ((error as ApiException).getResponse() as ApiErrorBody).error.code;
  }
  throw new Error('expected the call to reject');
}

describe('TikTokAdapter', () => {
  const adapter = adapterWith(CONFIG);

  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('getOAuthUrl', () => {
    it('sends the PKCE challenge and state to TikTok', () => {
      const url = new URL(
        adapter.getOAuthUrl({
          state: 'signed-state',
          redirectUri: 'https://api.swiply.test/api/social-accounts/callback/tiktok',
          codeChallenge: 'challenge-value',
        }),
      );

      expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
      expect(url.searchParams.get('client_key')).toBe('test-client-key');
      expect(url.searchParams.get('state')).toBe('signed-state');
      expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('response_type')).toBe('code');
    });

    it('never puts the client secret in the authorize URL', () => {
      const url = adapter.getOAuthUrl({
        state: 's',
        redirectUri: 'https://api.swiply.test/cb',
        codeChallenge: 'c',
      });

      expect(url).not.toContain('test-client-secret');
    });

    it('refuses when TikTok is not configured', () => {
      expect(() =>
        adapterWith({}).getOAuthUrl({ state: 's', redirectUri: 'u', codeChallenge: 'c' }),
      ).toThrow(ApiException);
    });
  });

  describe('handleOAuthCallback', () => {
    it('exchanges the code and resolves the profile', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/oauth/token/', (body: string) => {
          const params = new URLSearchParams(body);
          return (
            params.get('grant_type') === 'authorization_code' &&
            params.get('code') === 'auth-code' &&
            params.get('code_verifier') === 'verifier-value'
          );
        })
        .reply(200, {
          access_token: 'act.token',
          refresh_token: 'rft.token',
          expires_in: 86400,
          open_id: 'open-id-123',
          scope: 'user.info.basic,video.publish',
        });

      nock('https://open.tiktokapis.com')
        .get('/v2/user/info/')
        .query(true)
        .reply(200, {
          data: { user: { open_id: 'open-id-123', display_name: 'Cody', avatar_url: 'https://cdn/a.jpg' } },
        });

      const connection = await adapter.handleOAuthCallback({
        code: 'auth-code',
        redirectUri: 'https://api.swiply.test/cb',
        codeVerifier: 'verifier-value',
      });

      expect(connection).toMatchObject({
        accessToken: 'act.token',
        refreshToken: 'rft.token',
        accountId: 'open-id-123',
        displayName: 'Cody',
        avatarUrl: 'https://cdn/a.jpg',
        scopes: ['user.info.basic', 'video.publish'],
      });
      expect(connection.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    });

    it('falls back to a placeholder when the account has no display name', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/oauth/token/')
        .reply(200, { access_token: 'act.token', open_id: 'open-id-123' });
      nock('https://open.tiktokapis.com')
        .get('/v2/user/info/')
        .query(true)
        .reply(200, { data: { user: { open_id: 'open-id-123', display_name: '' } } });

      const connection = await adapter.handleOAuthCallback({
        code: 'c',
        redirectUri: 'u',
        codeVerifier: 'v',
      });

      expect(connection.displayName).toBe('TikTok account');
      // No expires_in means the adapter must not invent a deadline.
      expect(connection.expiresAt).toBeNull();
    });

    it('reports a rejected exchange without leaking the request back', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/oauth/token/')
        .reply(400, {
          error: 'invalid_grant',
          error_description: 'authorization code expired',
          // TikTok echoes the request; none of this may reach the caller.
          client_secret: 'test-client-secret',
        });

      let details: Record<string, unknown> = {};
      try {
        await adapter.handleOAuthCallback({ code: 'c', redirectUri: 'u', codeVerifier: 'v' });
      } catch (error) {
        const body = (error as ApiException).getResponse() as ApiErrorBody;
        expect(body.error.code).toBe('OAUTH_EXCHANGE_FAILED');
        details = body.error.details;
      }

      expect(JSON.stringify(details)).not.toContain('test-client-secret');
      expect(details.reason).toBe('invalid_grant');
    });

    it('treats a 200 with no access_token as a failure', async () => {
      nock('https://open.tiktokapis.com').post('/v2/oauth/token/').reply(200, { data: {} });

      expect(
        await codeOf(() =>
          adapter.handleOAuthCallback({ code: 'c', redirectUri: 'u', codeVerifier: 'v' }),
        ),
      ).toBe('OAUTH_EXCHANGE_FAILED');
    });
  });

  describe('refreshAccessToken', () => {
    it('sends the refresh grant and returns the new credentials', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/oauth/token/', (body: string) => {
          const params = new URLSearchParams(body);
          return (
            params.get('grant_type') === 'refresh_token' &&
            params.get('refresh_token') === 'old-refresh'
          );
        })
        .reply(200, { access_token: 'new.act', refresh_token: 'new.rft', expires_in: 3600 });

      const credentials = await adapter.refreshAccessToken('old-refresh');

      expect(credentials.accessToken).toBe('new.act');
      expect(credentials.refreshToken).toBe('new.rft');
    });

    it('reports a refused refresh under its own code', async () => {
      nock('https://open.tiktokapis.com')
        .post('/v2/oauth/token/')
        .reply(400, { error: 'invalid_grant' });

      // Distinct from OAUTH_EXCHANGE_FAILED so the caller knows to mark the
      // account expired rather than restart a connection flow.
      expect(await codeOf(() => adapter.refreshAccessToken('old-refresh'))).toBe(
        'TOKEN_REFRESH_FAILED',
      );
    });
  });
});

describe('TikTokAdapter.fetchPostMetrics', () => {
  const adapter = adapterWith(CONFIG);
  const video = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: `Video ${id}`,
    create_time: 1_790_000_000,
    cover_image_url: `https://cdn.tiktok.test/${id}.jpg`,
    share_url: `https://www.tiktok.com/@me/video/${id}`,
    view_count: 1000,
    like_count: 50,
    comment_count: 4,
    share_count: 2,
    ...extra,
  });

  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  it('asks for view counts and maps each video', async () => {
    let fields = '';
    nock('https://open.tiktokapis.com')
      .post('/v2/video/list/')
      .query((query) => {
        fields = String(query.fields);
        return true;
      })
      .reply(200, { data: { videos: [video('v1')], has_more: false, cursor: 0 } });

    const metrics = await adapter.fetchPostMetrics('token', 10);

    expect(fields.split(',')).toEqual(
      expect.arrayContaining(['view_count', 'like_count', 'comment_count', 'share_count']),
    );
    expect(metrics).toEqual([
      {
        platformPostId: 'v1',
        title: 'Video v1',
        postedAt: new Date(1_790_000_000 * 1000),
        coverImageUrl: 'https://cdn.tiktok.test/v1.jpg',
        shareUrl: 'https://www.tiktok.com/@me/video/v1',
        views: 1000,
        likes: 50,
        comments: 4,
        shares: 2,
      },
    ]);
  });

  it('follows the cursor across pages and stops at the limit', async () => {
    const cursors: number[] = [];
    nock('https://open.tiktokapis.com')
      .post('/v2/video/list/', (body: { cursor: number; max_count: number }) => {
        cursors.push(body.cursor);
        return true;
      })
      .query(true)
      .times(2)
      .reply((_uri, body) =>
        (body as { cursor: number }).cursor === 0
          ? [200, { data: { videos: Array.from({ length: 20 }, (_, i) => video(`a${i}`)), has_more: true, cursor: 111 } }]
          : [200, { data: { videos: Array.from({ length: 20 }, (_, i) => video(`b${i}`)), has_more: true, cursor: 222 } }],
      );

    const metrics = await adapter.fetchPostMetrics('token', 25);

    expect(cursors).toEqual([0, 111]);
    expect(metrics).toHaveLength(25);
    expect(metrics[24].platformPostId).toBe('b4');
  });

  it('treats missing counts as zero and skips videos without an id', async () => {
    nock('https://open.tiktokapis.com')
      .post('/v2/video/list/')
      .query(true)
      .reply(200, {
        data: {
          videos: [{ id: 'v1', create_time: 1_790_000_000 }, video('', {})],
          has_more: false,
        },
      });

    const [only, ...rest] = await adapter.fetchPostMetrics('token', 10);

    expect(rest).toHaveLength(0);
    expect(only).toMatchObject({ platformPostId: 'v1', title: null, views: 0, likes: 0, comments: 0, shares: 0 });
  });

  it('wraps TikTok failures in an ApiException', async () => {
    nock('https://open.tiktokapis.com').post('/v2/video/list/').query(true).reply(401, { error: { code: 'access_token_invalid' } });

    await expect(adapter.fetchPostMetrics('token', 10)).rejects.toBeInstanceOf(ApiException);
  });
});
