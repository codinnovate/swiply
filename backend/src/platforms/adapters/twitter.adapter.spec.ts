import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import nock from 'nock';

import { ApiException, ApiErrorBody } from '../../common/errors/api.exception';
import { TwitterAdapter } from './twitter.adapter';

const API = 'https://api.twitter.com';
const BASE_CONFIG = {
  'platforms.twitter.clientId': 'x-client-id',
  'platforms.twitter.clientSecret': 'x-client-secret',
};

function adapterWith(config: Record<string, string | undefined>): TwitterAdapter {
  return new TwitterAdapter(new HttpService(), {
    get: (key: string) => config[key],
  } as unknown as ConfigService);
}

describe('TwitterAdapter', () => {
  const adapter = adapterWith({ ...BASE_CONFIG, 'platforms.twitter.apiTier': 'basic' });

  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('mention support follows the API tier (Section 16)', () => {
    it.each([
      ['free', false],
      ['basic', true],
      ['pro', true],
    ])('tier %s -> supportsMentions %p', (tier, expected) => {
      expect(
        adapterWith({ ...BASE_CONFIG, 'platforms.twitter.apiTier': tier }).capabilities
          .supportsMentions,
      ).toBe(expected);
    });

    it('defaults to the free tier when unset', () => {
      expect(adapterWith(BASE_CONFIG).capabilities.supportsMentions).toBe(false);
    });

    it('still publishes and replies on the free tier', () => {
      const free = adapterWith({ ...BASE_CONFIG, 'platforms.twitter.apiTier': 'free' })
        .capabilities;

      // Only mention polling is gated; connecting and posting are not.
      expect(free.supportsPost).toBe(true);
      expect(free.supportsReplies).toBe(true);
    });
  });

  it('requests offline.access so a refresh token is issued at all', () => {
    const url = new URL(
      adapter.getOAuthUrl({ state: 's', redirectUri: 'u', codeChallenge: 'chal' }),
    );

    expect(url.searchParams.get('scope')).toContain('offline.access');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('authenticates the token exchange with HTTP Basic', async () => {
    const expected = `Basic ${Buffer.from('x-client-id:x-client-secret').toString('base64')}`;

    nock(API, { reqheaders: { authorization: expected } })
      .post('/2/oauth2/token', (body: string) =>
        new URLSearchParams(body).get('code_verifier') === 'verifier',
      )
      .reply(200, {
        access_token: 'x-access',
        refresh_token: 'x-refresh',
        expires_in: 7200,
        scope: 'tweet.read tweet.write users.read offline.access',
      });

    nock(API)
      .get('/2/users/me')
      .query(true)
      .reply(200, { data: { id: '1509', name: 'Cody', profile_image_url: 'https://cdn/x.jpg' } });

    const connection = await adapter.handleOAuthCallback({
      code: 'auth-code',
      redirectUri: 'https://api.swiply.test/cb',
      codeVerifier: 'verifier',
    });

    expect(connection.accessToken).toBe('x-access');
    expect(connection.accountId).toBe('1509');
    expect(connection.scopes).toEqual([
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ]);
  });

  it('prefers the handle over the display name, which is not unique', async () => {
    nock(API).post('/2/oauth2/token').reply(200, { access_token: 'x-access' });
    nock(API)
      .get('/2/users/me')
      .query(true)
      .reply(200, { data: { id: '1509', name: 'Cody', username: 'codybuilds' } });

    const connection = await adapter.handleOAuthCallback({
      code: 'c',
      redirectUri: 'u',
      codeVerifier: 'v',
    });

    expect(connection.displayName).toBe('@codybuilds');
  });

  it('surfaces a refused refresh as TOKEN_REFRESH_FAILED', async () => {
    nock(API).post('/2/oauth2/token').reply(400, { error: 'invalid_request' });

    try {
      await adapter.refreshAccessToken('stale-refresh');
      throw new Error('expected the call to reject');
    } catch (error) {
      const body = (error as ApiException).getResponse() as ApiErrorBody;
      expect(body.error.code).toBe('TOKEN_REFRESH_FAILED');
    }
  });

  it('refuses to start a flow when X is not configured', () => {
    expect(() =>
      adapterWith({}).getOAuthUrl({ state: 's', redirectUri: 'u', codeChallenge: 'c' }),
    ).toThrow(ApiException);
  });
});
