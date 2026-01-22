import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';

interface Registered {
  token: string;
  userId: string;
  defaultWorkspaceId: string;
  email: string;
}

describe('Workspaces (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await destroyTestApp(app);
  });

  afterEach(async () => {
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

  describe('GET /api/workspaces', () => {
    it('lists only workspaces the caller is a member of, with their role', async () => {
      const owner = await register('owner@example.com', 'Ada Lovelace');
      const stranger = await register('stranger@example.com');

      const ownerList = await server()
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      expect(ownerList.body.data).toHaveLength(1);
      expect(ownerList.body.data[0]).toMatchObject({
        id: owner.defaultWorkspaceId,
        name: "Ada's Workspace",
        role: 'owner',
        planId: 'free',
        timezone: 'UTC',
      });
      // Stripe identifiers must never be serialized out (Section 12).
      expect(ownerList.body.data[0]).not.toHaveProperty('stripeCustomerId');

      const strangerList = await server()
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(200);

      expect(
        strangerList.body.data.map((workspace: { id: string }) => workspace.id),
      ).not.toContain(owner.defaultWorkspaceId);
    });
  });

  describe('POST /api/workspaces', () => {
    it('creates a workspace with the caller as owner', async () => {
      const user = await register('creator@example.com');

      const created = await server()
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: 'Acme Social', timezone: 'Europe/London' })
        .expect(201);

      expect(created.body.data).toMatchObject({
        name: 'Acme Social',
        timezone: 'Europe/London',
        ownerId: user.userId,
      });

      const members = await server()
        .get(`/api/workspaces/${created.body.data.id}/members`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(members.body.data).toHaveLength(1);
      expect(members.body.data[0]).toMatchObject({ role: 'owner', status: 'active' });
    });

    it('rejects an invalid IANA timezone', async () => {
      const user = await register('creator@example.com');

      const response = await server()
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: 'Acme', timezone: 'Mars/Olympus_Mons' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('WorkspaceGuard', () => {
    it('denies access to a workspace the caller is not a member of', async () => {
      const owner = await register('owner@example.com');
      const stranger = await register('stranger@example.com');

      const response = await server()
        .get(`/api/workspaces/${owner.defaultWorkspaceId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);

      expect(response.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('returns the same 403 for a workspace that does not exist (no existence probing)', async () => {
      const stranger = await register('stranger@example.com');

      const response = await server()
        .get('/api/workspaces/64b7f3d2c8a1f2e4d5a6b7c8')
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);

      expect(response.body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
    });

    it('rejects a malformed workspace id', async () => {
      const user = await register('user@example.com');

      const response = await server()
        .get('/api/workspaces/not-an-object-id')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(422);

      expect(response.body.error.code).toBe('WORKSPACE_CONTEXT_REQUIRED');
    });

    it('enforces the role floor on privileged routes', async () => {
      const owner = await register('owner@example.com');
      const viewer = await register('viewer@example.com');

      await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: viewer.email, role: 'viewer' })
        .expect(201);

      // A viewer can read the workspace...
      await server()
        .get(`/api/workspaces/${owner.defaultWorkspaceId}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .expect(200);

      // ...but cannot rename it (@RequireRoles('admin')).
      const denied = await server()
        .patch(`/api/workspaces/${owner.defaultWorkspaceId}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ name: 'Hijacked' })
        .expect(403);

      expect(denied.body.error).toMatchObject({
        code: 'INSUFFICIENT_ROLE',
        details: { role: 'viewer', requiredRoles: ['admin'] },
      });
    });
  });

  describe('Members', () => {
    it('activates an invite immediately for an existing Swiply user', async () => {
      const owner = await register('owner@example.com');
      const teammate = await register('teammate@example.com');

      const invited = await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: teammate.email, role: 'editor' })
        .expect(201);

      expect(invited.body.data).toMatchObject({
        status: 'active',
        role: 'editor',
        userId: teammate.userId,
      });

      const teammateList = await server()
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${teammate.token}`)
        .expect(200);

      expect(teammateList.body.data.map((w: { id: string }) => w.id)).toContain(
        owner.defaultWorkspaceId,
      );
    });

    it('holds an invite as pending until that person signs up, then activates it', async () => {
      const owner = await register('owner@example.com');

      const invited = await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'future@example.com', role: 'editor' })
        .expect(201);

      expect(invited.body.data).toMatchObject({ status: 'pending', userId: null });

      const newcomer = await register('future@example.com');

      const newcomerList = await server()
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${newcomer.token}`)
        .expect(200);

      // Their own default workspace plus the one they were invited to.
      expect(newcomerList.body.data).toHaveLength(2);
      expect(newcomerList.body.data.map((w: { id: string }) => w.id)).toContain(
        owner.defaultWorkspaceId,
      );
    });

    it('rejects inviting the same person twice', async () => {
      const owner = await register('owner@example.com');

      await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'teammate@example.com', role: 'editor' })
        .expect(201);

      const response = await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'teammate@example.com', role: 'viewer' })
        .expect(409);

      expect(response.body.error.code).toBe('MEMBER_ALREADY_EXISTS');
    });

    it('refuses to invite anyone as owner', async () => {
      const owner = await register('owner@example.com');

      const response = await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'teammate@example.com', role: 'owner' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('refuses to demote or remove the owner', async () => {
      const owner = await register('owner@example.com');

      const members = await server()
        .get(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      const ownerMemberId = members.body.data[0].id;

      const demoted = await server()
        .patch(`/api/workspaces/${owner.defaultWorkspaceId}/members/${ownerMemberId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ role: 'viewer' })
        .expect(403);
      expect(demoted.body.error.code).toBe('CANNOT_REMOVE_OWNER');

      const removed = await server()
        .delete(`/api/workspaces/${owner.defaultWorkspaceId}/members/${ownerMemberId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(403);
      expect(removed.body.error.code).toBe('CANNOT_REMOVE_OWNER');
    });

    it('removes a member and revokes their access', async () => {
      const owner = await register('owner@example.com');
      const teammate = await register('teammate@example.com');

      const invited = await server()
        .post(`/api/workspaces/${owner.defaultWorkspaceId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: teammate.email, role: 'editor' })
        .expect(201);

      await server()
        .get(`/api/workspaces/${owner.defaultWorkspaceId}`)
        .set('Authorization', `Bearer ${teammate.token}`)
        .expect(200);

      await server()
        .delete(`/api/workspaces/${owner.defaultWorkspaceId}/members/${invited.body.data.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      await server()
        .get(`/api/workspaces/${owner.defaultWorkspaceId}`)
        .set('Authorization', `Bearer ${teammate.token}`)
        .expect(403);
    });
  });
});
