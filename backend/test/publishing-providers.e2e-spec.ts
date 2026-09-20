import { INestApplication } from '@nestjs/common';
import nock from 'nock';
import request from 'supertest';
import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';

describe('Publishing providers (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    nock.disableNetConnect();
    nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);
  });
  afterAll(async () => {
    nock.enableNetConnect();
    await destroyTestApp(app);
  });
  beforeEach(async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'publisher@example.com',
        name: 'Publisher',
        password: 'correct-horse-battery-1',
      })
      .expect(201);
    token = response.body.data.accessToken;
  });
  afterEach(async () => {
    nock.cleanAll();
    await clearDatabase(app);
  });

  it('requires authentication and starts empty', async () => {
    await request(app.getHttpServer()).get('/api/publishing-providers').expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/publishing-providers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data).toEqual([]);
  });

  it('validates and stores a Buffer key without returning it', async () => {
    nock('https://api.buffer.com')
      .post('/')
      .reply(200, {
        data: { account: { organizations: [{ id: 'org-1', name: 'Creator Studio' }] } },
      });
    const discovered = await request(app.getHttpServer())
      .post('/api/publishing-providers/buffer/discover')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiKey: 'buffer-super-secret-key' })
      .expect(201);
    expect(discovered.body.data.organizations).toEqual([{ id: 'org-1', name: 'Creator Studio' }]);
    expect(JSON.stringify(discovered.body)).not.toContain('buffer-super-secret-key');

    nock('https://api.buffer.com')
      .post('/')
      .reply(200, {
        data: { account: { organizations: [{ id: 'org-1', name: 'Creator Studio' }] } },
      });
    nock('https://api.buffer.com')
      .post('/')
      .reply(200, { data: { channels: [] } });
    const saved = await request(app.getHttpServer())
      .put('/api/publishing-providers/buffer')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiKey: 'buffer-super-secret-key', organizationId: 'org-1' })
      .expect(200);
    expect(saved.body.data).toMatchObject({
      provider: 'buffer',
      keyHint: '-key',
      organizationId: 'org-1',
      organizationName: 'Creator Studio',
    });
    expect(JSON.stringify(saved.body)).not.toContain('buffer-super-secret-key');

    const listed = await request(app.getHttpServer())
      .get('/api/publishing-providers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.data[0]).toMatchObject({ provider: 'buffer', keyHint: '-key' });
    expect(JSON.stringify(listed.body)).not.toContain('buffer-super-secret-key');
  });
});
