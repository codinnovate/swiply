import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';

import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';
import { MediaAsset, MediaAssetDocument } from '../src/modules/media/schemas/media-asset.schema';

describe('Media uploads (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let workspaceId: string;
  let userId: string;
  let assetModel: Model<MediaAssetDocument>;

  beforeAll(async () => {
    delete process.env.AWS_REGION;
    delete process.env.S3_BUCKET;
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.CLOUDFRONT_DISTRIBUTION_ID;
    app = await createTestApp();
    assetModel = app.get(getModelToken(MediaAsset.name));
  });

  afterAll(async () => {
    await destroyTestApp(app);
  });

  beforeEach(async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'media@example.com',
        name: 'Media User',
        password: 'correct-horse-battery-1',
      })
      .expect(201);
    token = registered.body.data.accessToken;
    workspaceId = registered.body.data.user.defaultWorkspaceId;
    userId = registered.body.data.user.id;
  });

  afterEach(async () => {
    await clearDatabase(app);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/media/uploads')
      .send({ fileName: 'image.png', mimeType: 'image/png', sizeBytes: 100, type: 'image' })
      .expect(401);
  });

  it('rejects unsupported media through the public validation contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/media/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send({ fileName: 'vector.svg', mimeType: 'image/svg+xml', sizeBytes: 100, type: 'image' })
      .expect(422);

    expect(response.body.error.code).toBe('MEDIA_UPLOAD_INVALID');
  });

  it('returns an explicit service error when AWS storage is absent in development', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/media/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send({ fileName: 'image.png', mimeType: 'image/png', sizeBytes: 100, type: 'image' })
      .expect(503);

    expect(response.body.error.code).toBe('STORAGE_NOT_CONFIGURED');
  });

  async function seedAsset(tags: string[] = []) {
    const key = new Types.ObjectId().toHexString();
    return assetModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      url: `https://cdn.example.com/${key}.png`,
      storageProvider: 'external',
      storageKey: `test/${key}`,
      mimeType: 'image/png',
      sizeBytes: 1024,
      type: 'image',
      tags,
      width: 800,
      height: 600,
      uploadedByUserId: new Types.ObjectId(userId),
    });
  }

  it('paginates the library and reports whether more results remain', async () => {
    for (let i = 0; i < 3; i += 1) await seedAsset();

    const first = await request(app.getHttpServer())
      .get('/api/media')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.hasMore).toBe(true);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app.getHttpServer())
      .get('/api/media')
      .query({ limit: 2, cursor: first.body.nextCursor })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.hasMore).toBe(false);
  });

  it('updates tags on an existing media asset', async () => {
    const asset = await seedAsset(['old']);

    const response = await request(app.getHttpServer())
      .patch(`/api/media/${asset.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['new', 'library'] })
      .expect(200);

    expect(response.body.data.tags).toEqual(['new', 'library']);
  });
});
