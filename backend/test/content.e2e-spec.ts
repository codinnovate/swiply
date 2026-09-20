import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';

import { createTestApp, destroyTestApp } from './app-harness';
import { clearDatabase } from './mongo-test-env';
import { MediaAsset, MediaAssetDocument } from '../src/modules/media/schemas/media-asset.schema';

describe('Content library integration (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let workspaceId: string;
  let userId: string;
  let assetModel: Model<MediaAssetDocument>;

  beforeAll(async () => {
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
        email: 'library@example.com',
        name: 'Library User',
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

  async function seedAsset(url: string) {
    const asset = await assetModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      url,
      storageProvider: 'external',
      storageKey: `test/${new Types.ObjectId().toHexString()}`,
      mimeType: 'image/png',
      sizeBytes: 1024,
      type: 'image',
      tags: ['library'],
      width: 800,
      height: 600,
      uploadedByUserId: new Types.ObjectId(userId),
    });
    return asset;
  }

  it('resolves a slide imageUrl from the referenced library asset and records usage', async () => {
    const assetA = await seedAsset('https://cdn.example.com/real-a.png');
    const assetB = await seedAsset('https://cdn.example.com/real-b.png');

    const response = await request(app.getHttpServer())
      .post('/api/content')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'slideshow',
        imageSource: 'user_provided',
        slideCount: 2,
        providedImageUrls: [
          'https://attacker.example.com/spoofed.png',
          'https://cdn.example.com/real-b.png',
        ],
        providedMediaAssetIds: [assetA.id, ''],
      })
      .expect(201);

    const slides = response.body.data.slideshow.slides;
    expect(slides[0].imageUrl).toBe('https://cdn.example.com/real-a.png');
    expect(slides[0].mediaAssetId).toBe(assetA.id);
    expect(slides[1].imageUrl).toBe('https://cdn.example.com/real-b.png');

    const updatedAssetA = await assetModel.findById(assetA._id).exec();
    expect(updatedAssetA?.usedCount).toBe(1);
    expect(updatedAssetA?.lastUsedAt).not.toBeNull();
    const updatedAssetB = await assetModel.findById(assetB._id).exec();
    expect(updatedAssetB?.usedCount).toBe(0);

    const usages = await request(app.getHttpServer())
      .get('/api/content')
      .query({ mediaAssetId: assetA.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(usages.body.data).toHaveLength(1);
    expect(usages.body.data[0]._id).toBe(response.body.data._id);
  });

  it('rejects a mediaAssetId that does not belong to the workspace', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/content')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'slideshow',
        imageSource: 'user_provided',
        slideCount: 2,
        providedImageUrls: [
          'https://cdn.example.com/a.png',
          'https://cdn.example.com/b.png',
        ],
        providedMediaAssetIds: [new Types.ObjectId().toHexString(), ''],
      })
      .expect(422);

    expect(response.body.error.code).toBe('MEDIA_ASSET_NOT_FOUND');
  });
});
