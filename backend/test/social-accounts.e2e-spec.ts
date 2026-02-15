import { INestApplication } from '@nestjs/common';
import nock from 'nock';
import request from 'supertest';

import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';

interface Registered {
  token: string;
  userId: string;
  defaultWorkspaceId: string;
  email: string;
}

const TIKTOK = 'https://open.tiktokapis.com';

/** The TikTok half of a successful connect. */
function mockTikTokConnect(openId = 'open-id-1', displayName = 'Cody') {
  nock(TIKTOK).post('/v2/oauth/token/').reply(200, {
    access_token: 'act.super-secret-token',
    refresh_token: 'rft.super-secret-token',
    expires_in: 86400,
    open_id: openId,
    scope: 'user.info.basic,video.publish',
  });

  nock(TIKTOK)
    .get('/v2/user/info/')
    .query(true)
    .reply(200, {
      data: { user: { open_id: openId, display_name: displayName, avatar_url: 'https://cdn/a.jpg' } },
    });
}

describe('Social accounts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    nock.disableNetConnect();
    // supertest and mongodb-memory-server both talk to loopback.
    nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);
  });

  afterAll(async () => {
    nock.enableNetConnect();
    await destroyTestApp(app);
  });

  afterEach(async () => {
    nock.cleanAll();
    await clearDatabase(app);
  });

  const server = () => request(app.getHttpServer());

  async function register(email: string, name = 'Test User'): Promise<Registered> {
    const response = await server()
      .post('/api/auth/register')
      .send({ email, name, password: 'correct-horse-battery-1' })
      .expect(201);

    return {
      token: response.body.data.accessToken,
      userId: response.body.data.user.id,
      defaultWorkspaceId: response.body.data.user.defaultWorkspaceId,
      email,
    };
  }

  /** Runs the full connect handshake and returns the created account. */
  async function connectTikTok(user: Registered, openId = 'open-id-1', displayName = 'Cody') {
    const begin = await server()
      .get('/api/social-accounts/connect/tiktok')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    const state = new URL(begin.body.data.authorizeUrl).searchParams.get('state') as string;
    mockTikTokConnect(openId, displayName);

    const callback = await server()
      .get('/api/social-accounts/callback/tiktok')
      .query({ code: 'auth-code', state })
      .expect(302);

    return { state, location: new URL(callback.headers.location as string) };
  }

  describe('GET /api/social-accounts/platforms', () => {
    it('reports all six platforms with what this deployment can do', async () => {
      const user = await register('owner@example.com');

      const response = await server()
        .get('/api/social-accounts/platforms')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(6);
      expect(response.body.data.find((p: { platform: string }) => p.platform === 'tiktok'))
        .toMatchObject({ implemented: true, configured: true });
      expect(response.body.data.find((p: { platform: string }) => p.platform === 'pinterest'))
        .toMatchObject({ implemented: false });
    });
  });

  describe('GET /api/social-accounts/connect/:platform', () => {
    it('hands back an authorize URL carrying state and a PKCE challenge', async () => {
      const user = await register('owner@example.com');

      const response = await server()
        .get('/api/social-accounts/connect/tiktok')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      const url = new URL(response.body.data.authorizeUrl);
      expect(url.host).toBe('www.tiktok.com');
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      // The redirect URI is built from API_BASE_URL, never the request Host.
      expect(url.searchParams.get('redirect_uri')).toBe(
        'https://api.swiply.test/api/social-accounts/callback/tiktok',
      );
    });

    it('does not leak the workspace id into the state', async () => {
      const user = await register('owner@example.com');

      const response = await server()
        .get('/api/social-accounts/connect/tiktok')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.authorizeUrl).not.toContain(user.defaultWorkspaceId);
    });

    it('rejects a platform that has no adapter yet', async () => {
      const user = await register('owner@example.com');

      const response = await server()
        .get('/api/social-accounts/connect/linkedin')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(422);

      expect(response.body.error.code).toBe('PLATFORM_NOT_SUPPORTED');
    });

    it('requires admin — an editor cannot bind credentials to the workspace', async () => {
      const owner = await register('owner@example.com');
      await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'editor@example.com', role: 'editor' })
        .expect(201);

      const editor = await register('editor@example.com');

      const response = await server()
        .get('/api/social-accounts/connect/tiktok')
        .set('Authorization', `Bearer ${editor.token}`)
        .set('X-Workspace-Id', owner.defaultWorkspaceId)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
    });
  });

  describe('GET /api/social-accounts/callback/:platform', () => {
    it('completes the connection and redirects to the dashboard', async () => {
      const user = await register('owner@example.com');
      const { location } = await connectTikTok(user);

      expect(location.origin).toBe('https://app.swiply.test');
      expect(location.searchParams.get('status')).toBe('connected');
      expect(location.searchParams.get('platform')).toBe('tiktok');
      // Section 7: the frontend owns the consent prompt.
      expect(location.searchParams.get('askVoiceConsent')).toBe('1');
    });

    it('runs without a bearer token — the platform redirects the browser here', async () => {
      const user = await register('owner@example.com');
      const begin = await server()
        .get('/api/social-accounts/connect/tiktok')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      const state = new URL(begin.body.data.authorizeUrl).searchParams.get('state') as string;
      mockTikTokConnect();

      // No Authorization header at all.
      await server()
        .get('/api/social-accounts/callback/tiktok')
        .query({ code: 'auth-code', state })
        .expect(302);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(list.body.data).toHaveLength(1);
    });

    it('never returns the stored tokens', async () => {
      const user = await register('owner@example.com');
      await connectTikTok(user);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      const serialized = JSON.stringify(list.body);
      expect(serialized).not.toContain('act.super-secret-token');
      expect(serialized).not.toContain('rft.super-secret-token');
      expect(list.body.data[0]).not.toHaveProperty('accessToken');
      expect(list.body.data[0]).not.toHaveProperty('refreshToken');
      expect(list.body.data[0]).toMatchObject({
        platform: 'tiktok',
        displayName: 'Cody',
        status: 'active',
      });
    });

    it('redirects with an error code instead of a JSON body on a forged state', async () => {
      await register('owner@example.com');

      const response = await server()
        .get('/api/social-accounts/callback/tiktok')
        .query({ code: 'auth-code', state: 'not-a-real-state' })
        .expect(302);

      // A browser mid-redirect cannot render an error body.
      const location = new URL(response.headers.location as string);
      expect(location.searchParams.get('status')).toBe('error');
      expect(location.searchParams.get('code')).toBe('OAUTH_STATE_INVALID');
    });

    it('refuses a state minted for another platform', async () => {
      const user = await register('owner@example.com');
      const begin = await server()
        .get('/api/social-accounts/connect/tiktok')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      const state = new URL(begin.body.data.authorizeUrl).searchParams.get('state') as string;

      const response = await server()
        .get('/api/social-accounts/callback/instagram')
        .query({ code: 'auth-code', state })
        .expect(302);

      expect(new URL(response.headers.location as string).searchParams.get('code')).toBe(
        'OAUTH_STATE_INVALID',
      );
    });

    it('reports a declined authorization as such', async () => {
      const user = await register('owner@example.com');
      const begin = await server()
        .get('/api/social-accounts/connect/tiktok')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      const state = new URL(begin.body.data.authorizeUrl).searchParams.get('state') as string;

      const response = await server()
        .get('/api/social-accounts/callback/tiktok')
        .query({ state, error: 'access_denied', error_description: 'user cancelled' })
        .expect(302);

      expect(new URL(response.headers.location as string).searchParams.get('code')).toBe(
        'OAUTH_ACCESS_DENIED',
      );
    });

    it('updates the existing row when the same account reconnects', async () => {
      const user = await register('owner@example.com');
      await connectTikTok(user, 'open-id-1', 'Cody');
      await connectTikTok(user, 'open-id-1', 'Cody Renamed');

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      // One row, not two competing sets of credentials.
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].displayName).toBe('Cody Renamed');
    });
  });

  describe('workspace scoping', () => {
    it('does not show one workspace’s accounts to another', async () => {
      const owner = await register('owner@example.com');
      const stranger = await register('stranger@example.com');
      await connectTikTok(owner);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(200);

      expect(list.body.data).toHaveLength(0);
    });

    it('refuses a cross-workspace disconnect the same way as a missing account', async () => {
      const owner = await register('owner@example.com');
      const stranger = await register('stranger@example.com');
      await connectTikTok(owner);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      const accountId = list.body.data[0].id;

      const denied = await server()
        .delete(`/api/social-accounts/${accountId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);

      const missing = await server()
        .delete('/api/social-accounts/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);

      // Identical apart from the id the caller itself supplied, so an account
      // in another workspace is indistinguishable from one that never existed.
      expect(denied.body.error.code).toBe(missing.body.error.code);
      expect(denied.body.error.message).toBe(missing.body.error.message);
      expect(Object.keys(denied.body.error.details)).toEqual(['accountId']);
    });

    it('treats a malformed id as a miss rather than a cast crash', async () => {
      const user = await register('owner@example.com');

      const response = await server()
        .delete('/api/social-accounts/not-an-object-id')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(404);

      expect(response.body.error.code).toBe('SOCIAL_ACCOUNT_NOT_FOUND');
    });
  });

  describe('DELETE /api/social-accounts/:id', () => {
    it('removes the account and its stored credentials', async () => {
      const user = await register('owner@example.com');
      await connectTikTok(user);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      await server()
        .delete(`/api/social-accounts/${list.body.data[0].id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(204);

      const after = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(after.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/social-accounts/:id/voice-consent', () => {
    it('records consent and stops the dashboard re-asking on reconnect', async () => {
      const user = await register('owner@example.com');
      await connectTikTok(user);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      const accountId = list.body.data[0].id;

      const granted = await server()
        .post(`/api/social-accounts/${accountId}/voice-consent`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ consent: true })
        .expect(201);

      expect(granted.body.data.voiceIngestionConsentedAt).not.toBeNull();

      // Reconnecting must not silently re-ask or re-grant.
      const { location } = await connectTikTok(user);
      expect(location.searchParams.get('askVoiceConsent')).toBeNull();
    });

    it('lets the user withdraw consent', async () => {
      const user = await register('owner@example.com');
      await connectTikTok(user);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      const accountId = list.body.data[0].id;

      await server()
        .post(`/api/social-accounts/${accountId}/voice-consent`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ consent: true })
        .expect(201);

      const withdrawn = await server()
        .post(`/api/social-accounts/${accountId}/voice-consent`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ consent: false })
        .expect(201);

      expect(withdrawn.body.data.voiceIngestionConsentedAt).toBeNull();
    });

    it('rejects an unknown field rather than dropping it', async () => {
      const user = await register('owner@example.com');
      await connectTikTok(user);

      const list = await server()
        .get('/api/social-accounts')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      await server()
        .post(`/api/social-accounts/${list.body.data[0].id}/voice-consent`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ consent: true, sneaky: 'value' })
        .expect(400);
    });
  });
});
