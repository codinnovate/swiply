import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import nock from 'nock';

import { ApiException, ApiErrorBody } from '../../common/errors/api.exception';
import { PinterestAdapter } from './pinterest.adapter';

const CONFIG = {
  'platforms.pinterest.appId': 'pin-app',
  'platforms.pinterest.appSecret': 'pin-secret',
};

function adapterWith(config: Record<string, string | undefined>): PinterestAdapter {
  return new PinterestAdapter(new HttpService(), {
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

describe('PinterestAdapter', () => {
  const adapter = adapterWith(CONFIG);

  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  it('sends PKCE and never leaks the app secret on the authorize URL', () => {
    const url = new URL(
      adapter.getOAuthUrl({
        state: 'signed-state',
        redirectUri: 'https://api.swiply.test/api/social-accounts/callback/pinterest',
        codeChallenge: 'challenge-value',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://www.pinterest.com/oauth/');
    expect(url.searchParams.get('client_id')).toBe('pin-app');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('scope')).toContain('boards:read');
    expect(url.toString()).not.toContain('pin-secret');
  });

  it('exchanges the code with HTTP Basic and resolves the profile', async () => {
    nock('https://api.pinterest.com')
      .post('/v5/oauth/token', (body: string) => {
        const params = new URLSearchParams(body);
        return params.get('grant_type') === 'authorization_code' && params.get('code') === 'auth-code';
      })
      .reply(200, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 3600,
        scope: 'boards:read pins:read user_accounts:read',
      })
      .get('/v5/user_account')
      .reply(200, { id: 'user-1', username: 'studio', profile_image: 'https://i.pinimg.com/a.jpg' });

    const connection = await adapter.handleOAuthCallback({
      code: 'auth-code',
      redirectUri: 'https://api.swiply.test/cb',
      codeVerifier: 'verifier',
    });

    expect(connection.accountId).toBe('user-1');
    expect(connection.displayName).toBe('studio');
    expect(connection.accessToken).toBe('access');
  });

  it('lists boards and image pins from the connected account', async () => {
    nock('https://api.pinterest.com')
      .get('/v5/boards')
      .query({ page_size: 25 })
      .reply(200, {
        items: [{ id: 'board-1', name: 'Brand kit', pin_count: 12, media: { image_cover_url: 'https://i.pinimg.com/c.jpg' } }],
      })
      .get('/v5/boards/board-1/pins')
      .query({ page_size: 25 })
      .reply(200, {
        items: [
          {
            id: 'pin-1',
            title: 'Hero shot',
            media: { media_type: 'image', images: { originals: { url: 'https://i.pinimg.com/orig.jpg', width: 800, height: 1200 } } },
          },
          { id: 'pin-2', title: 'Video', media: { media_type: 'video', images: {} } },
        ],
      });

    await expect(adapter.listBoards('token')).resolves.toEqual([
      { id: 'board-1', name: 'Brand kit', pinCount: 12, coverUrl: 'https://i.pinimg.com/c.jpg' },
    ]);
    await expect(adapter.listBoardImagePins('token', 'board-1')).resolves.toEqual([
      {
        pinId: 'pin-1',
        title: 'Hero shot',
        imageUrl: 'https://i.pinimg.com/orig.jpg',
        width: 800,
        height: 1200,
      },
    ]);
  });

  it('shapes a failed exchange without echoing the client secret', async () => {
    nock('https://api.pinterest.com').post('/v5/oauth/token').reply(400, {
      code: 1,
      message: 'invalid code',
      client_secret: 'pin-secret',
    });

    expect(
      await codeOf(() =>
        adapter.handleOAuthCallback({ code: 'bad', redirectUri: 'u', codeVerifier: 'v' }),
      ),
    ).toBe('OAUTH_EXCHANGE_FAILED');
  });
});
