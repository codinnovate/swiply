import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import nock from 'nock';

import { ApiException, ApiErrorBody } from '../../common/errors/api.exception';
import { InstagramAdapter } from './instagram.adapter';

const GRAPH = 'https://graph.facebook.com';
const CONFIG = {
  'platforms.meta.appId': 'meta-app-id',
  'platforms.meta.appSecret': 'meta-app-secret',
};

function adapterWith(config: Record<string, string | undefined>): InstagramAdapter {
  return new InstagramAdapter(new HttpService(), {
    get: (key: string) => config[key],
  } as unknown as ConfigService);
}

async function bodyOf(run: () => Promise<unknown>): Promise<ApiErrorBody['error']> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return ((error as ApiException).getResponse() as ApiErrorBody).error;
  }
  throw new Error('expected the call to reject');
}

/** Short-lived exchange, long-lived exchange, then the Page lookup. */
function mockHappyPath(pages: unknown) {
  nock(GRAPH)
    .get('/v21.0/oauth/access_token')
    .query((q) => q.code === 'auth-code')
    .reply(200, { access_token: 'short-lived-token', expires_in: 3600 });

  nock(GRAPH)
    .get('/v21.0/oauth/access_token')
    .query((q) => q.grant_type === 'fb_exchange_token')
    .reply(200, { access_token: 'long-lived-user-token', expires_in: 5_184_000 });

  nock(GRAPH).get('/v21.0/me/accounts').query(true).reply(200, { data: pages });
}

describe('InstagramAdapter', () => {
  const adapter = adapterWith(CONFIG);

  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  it('does not advertise PKCE, which Meta does not implement', () => {
    expect(adapter.capabilities.usesPkce).toBe(false);
  });

  it('builds an authorize URL with the signed state and no secret', () => {
    const url = new URL(
      adapter.getOAuthUrl({
        state: 'signed-state',
        redirectUri: 'https://api.swiply.test/cb',
        codeChallenge: 'ignored-by-meta',
      }),
    );

    expect(url.searchParams.get('client_id')).toBe('meta-app-id');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('scope')).toContain('instagram_content_publish');
    expect(url.toString()).not.toContain('meta-app-secret');
  });

  it('stores the Page token for publishing and the long-lived user token for refresh', async () => {
    mockHappyPath([
      { id: 'page-1', name: 'Cody Page', access_token: 'page-access-token',
        instagram_business_account: {
          id: 'ig-17841400000000000',
          username: 'codybuilds',
          profile_picture_url: 'https://cdn/ig.jpg',
        } },
    ]);

    const connection = await adapter.handleOAuthCallback({
      code: 'auth-code',
      redirectUri: 'https://api.swiply.test/cb',
      codeVerifier: 'unused',
    });

    // The Page token is what the publish API accepts; the user token is only
    // good for re-deriving it, which is what refresh does here.
    expect(connection.accessToken).toBe('page-access-token');
    expect(connection.refreshToken).toBe('long-lived-user-token');
    expect(connection.accountId).toBe('ig-17841400000000000');
    expect(connection.displayName).toBe('codybuilds');
    expect(connection.avatarUrl).toBe('https://cdn/ig.jpg');
  });

  it('skips Pages that have no linked Instagram account', async () => {
    mockHappyPath([
      { id: 'page-1', name: 'Personal Page', access_token: 'token-a' },
      { id: 'page-2', name: 'Business Page', access_token: 'token-b',
        instagram_business_account: { id: 'ig-2', username: 'business' } },
    ]);

    const connection = await adapter.handleOAuthCallback({
      code: 'auth-code',
      redirectUri: 'https://api.swiply.test/cb',
      codeVerifier: 'unused',
    });

    expect(connection.accountId).toBe('ig-2');
  });

  it('names the missing IG Business link rather than reporting a generic failure', async () => {
    mockHappyPath([{ id: 'page-1', name: 'Personal Page', access_token: 'token-a' }]);

    // The user granted every scope correctly; the fix is in their Page
    // settings, which the dashboard can only say if this is its own code.
    const body = await bodyOf(() =>
      adapter.handleOAuthCallback({
        code: 'auth-code',
        redirectUri: 'https://api.swiply.test/cb',
        codeVerifier: 'unused',
      }),
    );

    expect(body.code).toBe('INSTAGRAM_BUSINESS_ACCOUNT_REQUIRED');
  });

  it('reports a rejected exchange without echoing the app secret', async () => {
    nock(GRAPH)
      .get('/v21.0/oauth/access_token')
      .query(true)
      .reply(400, {
        error: { message: 'This authorization code has been used.' },
        error_description: 'invalid_code',
        client_secret: 'meta-app-secret',
      });

    const body = await bodyOf(() =>
      adapter.handleOAuthCallback({ code: 'used', redirectUri: 'u', codeVerifier: 'v' }),
    );

    expect(body.code).toBe('OAUTH_EXCHANGE_FAILED');
    expect(JSON.stringify(body.details)).not.toContain('meta-app-secret');
  });

  it('re-derives the Page token on refresh', async () => {
    nock(GRAPH)
      .get('/v21.0/oauth/access_token')
      .query((q) => q.grant_type === 'fb_exchange_token')
      .reply(200, { access_token: 'renewed-user-token', expires_in: 5_184_000 });

    nock(GRAPH)
      .get('/v21.0/me/accounts')
      .query(true)
      .reply(200, {
        data: [
          { id: 'page-1', access_token: 'renewed-page-token',
            instagram_business_account: { id: 'ig-2', username: 'business' } },
        ],
      });

    const credentials = await adapter.refreshAccessToken('long-lived-user-token');

    expect(credentials.accessToken).toBe('renewed-page-token');
    expect(credentials.refreshToken).toBe('renewed-user-token');
  });

  it('refuses to start a flow when Meta is not configured', () => {
    expect(() =>
      adapterWith({}).getOAuthUrl({ state: 's', redirectUri: 'u', codeChallenge: 'c' }),
    ).toThrow(ApiException);
  });
});
