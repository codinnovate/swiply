import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';

const VALID_USER = {
  email: 'creator@example.com',
  name: 'Ada Lovelace',
  password: 'correct-horse-battery-1',
  timezone: 'Europe/London',
};

describe('Auth (e2e)', () => {
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

  describe('POST /api/auth/register', () => {
    it('creates the user, a default workspace, and returns a JWT', async () => {
      const response = await server().post('/api/auth/register').send(VALID_USER).expect(201);

      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user).toMatchObject({
        email: VALID_USER.email,
        name: VALID_USER.name,
        emailVerified: false,
      });
      // Section 4.1: every user lands in a workspace immediately.
      expect(response.body.data.user.defaultWorkspaceId).toEqual(expect.any(String));
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a duplicate email with EMAIL_ALREADY_REGISTERED', async () => {
      await server().post('/api/auth/register').send(VALID_USER).expect(201);

      const response = await server().post('/api/auth/register').send(VALID_USER).expect(409);

      expect(response.body).toEqual({
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: expect.any(String),
          details: { email: VALID_USER.email },
        },
      });
    });

    it('rejects a weak password in the Section 5 error shape', async () => {
      const response = await server()
        .post('/api/auth/register')
        .send({ ...VALID_USER, password: 'short' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Password')]),
      );
    });

    it('rejects unknown fields rather than silently dropping them (Section 12)', async () => {
      const response = await server()
        .post('/api/auth/register')
        .send({ ...VALID_USER, planId: 'agency' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('planId')]),
      );
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await server().post('/api/auth/register').send(VALID_USER).expect(201);
    });

    it('returns a token for correct credentials', async () => {
      const response = await server()
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password })
        .expect(200);

      expect(response.body.data.accessToken).toEqual(expect.any(String));
    });

    it('returns the same INVALID_CREDENTIALS for a wrong password and an unknown email', async () => {
      const wrongPassword = await server()
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: 'definitely-not-it-1' })
        .expect(401);

      const unknownEmail = await server()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: VALID_USER.password })
        .expect(401);

      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmail.body.error).toEqual(wrongPassword.body.error);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await server().get('/api/auth/me').expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a garbage bearer token', async () => {
      const response = await server()
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns the caller for a valid token', async () => {
      const registered = await server().post('/api/auth/register').send(VALID_USER).expect(201);

      const response = await server()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registered.body.data.accessToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        email: VALID_USER.email,
        name: VALID_USER.name,
      });
    });
  });

  describe('GET /api/auth/google', () => {
    it('reports OAUTH_PROVIDER_NOT_CONFIGURED when credentials are absent', async () => {
      const response = await server().get('/api/auth/google').expect(422);
      expect(response.body.error.code).toBe('OAUTH_PROVIDER_NOT_CONFIGURED');
    });
  });
});
