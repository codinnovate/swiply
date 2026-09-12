import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';

describe('AI settings (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await destroyTestApp(app);
  });

  beforeEach(async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'ai-settings@example.com',
        name: 'AI Settings User',
        password: 'correct-horse-battery-1',
      })
      .expect(201);
    token = registered.body.data.accessToken;
  });

  afterEach(async () => {
    await clearDatabase(app);
  });

  it('lists the supported OpenAI models', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/ai/models')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'gpt-5-mini' })]),
    );
  });

  it('returns no credentials for a new user and never accepts unauthenticated access', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/ai/credentials')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data).toEqual([]);

    await request(app.getHttpServer()).get('/api/ai/credentials').expect(401);
  });

  it('rejects unsupported model ids before making an OpenAI request', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/ai/credentials/openai')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiKey: 'sk-test-key-that-is-long-enough', defaultModel: 'unknown-model' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});
