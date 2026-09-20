import { Model, Types } from 'mongoose';

import { MediaService } from './media.service';
import { MediaAssetDocument } from './schemas/media-asset.schema';
import { MediaUploadDocument } from './schemas/media-upload.schema';
import { S3StorageService, UPLOAD_PART_SIZE } from './s3-storage.service';

const workspaceId = new Types.ObjectId().toHexString();
const userId = new Types.ObjectId().toHexString();

describe('MediaService', () => {
  const assetModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  };
  const uploadModel = {
    create: jest.fn(),
    findOne: jest.fn(),
  };
  const storage = {
    assertConfigured: jest.fn(),
    buildObjectKey: jest.fn(),
    createMultipartUpload: jest.fn(),
    abortMultipartUpload: jest.fn(),
    signPart: jest.fn(),
    completeMultipartUpload: jest.fn(),
    headObject: jest.fn(),
    publicUrl: jest.fn(),
    deleteObjectAndInvalidate: jest.fn(),
  };

  let service: MediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MediaService(
      assetModel as unknown as Model<MediaAssetDocument>,
      uploadModel as unknown as Model<MediaUploadDocument>,
      storage as unknown as S3StorageService,
    );
  });

  it('initiates a workspace-scoped multipart upload', async () => {
    storage.buildObjectKey.mockReturnValue('workspaces/workspace/key/image.png');
    storage.createMultipartUpload.mockResolvedValue('s3-upload-id');
    uploadModel.create.mockResolvedValue({ id: 'mongo-upload-id' });

    const result = await service.initiate(workspaceId, userId, {
      fileName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: UPLOAD_PART_SIZE + 1,
      type: 'image',
    });

    expect(result).toMatchObject({
      id: 'mongo-upload-id',
      partCount: 2,
      partSize: UPLOAD_PART_SIZE,
    });
    expect(storage.createMultipartUpload).toHaveBeenCalledWith(
      'workspaces/workspace/key/image.png',
      'image/png',
      workspaceId,
    );
    expect(uploadModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: new Types.ObjectId(workspaceId),
        uploadedByUserId: new Types.ObjectId(userId),
        partCount: 2,
      }),
    );
  });

  it('rejects an unsupported content type before calling AWS', async () => {
    await expect(
      service.initiate(workspaceId, userId, {
        fileName: 'payload.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 100,
        type: 'image',
      }),
    ).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_INVALID' });
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });

  it('rejects images larger than 50 MB', async () => {
    await expect(
      service.initiate(workspaceId, userId, {
        fileName: 'large.png',
        mimeType: 'image/png',
        sizeBytes: 50 * 1024 * 1024 + 1,
        type: 'image',
      }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('does not sign a part outside the upload range', async () => {
    uploadModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        partCount: 2,
        storageKey: 'workspaces/key',
        s3UploadId: 's3-id',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });

    await expect(
      service.signParts(workspaceId, new Types.ObjectId().toHexString(), [3]),
    ).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_INVALID' });
    expect(storage.signPart).not.toHaveBeenCalled();
  });

  it('completes parts in order and creates a CloudFront-backed asset', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const upload = {
      workspaceId: new Types.ObjectId(workspaceId),
      uploadedByUserId: new Types.ObjectId(userId),
      storageKey: 'workspaces/key',
      s3UploadId: 's3-id',
      mimeType: 'video/mp4',
      sizeBytes: 20,
      type: 'video',
      tags: ['demo'],
      width: null,
      height: null,
      partCount: 2,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      save,
    };
    uploadModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(upload) });
    assetModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    storage.completeMultipartUpload.mockResolvedValue(undefined);
    storage.headObject.mockResolvedValue({ sizeBytes: 20, mimeType: 'video/mp4' });
    storage.publicUrl.mockReturnValue('https://cdn.example.com/workspaces/key');
    assetModel.create.mockResolvedValue({ id: 'asset-id' });

    const result = await service.complete(workspaceId, new Types.ObjectId().toHexString(), {
      parts: [
        { partNumber: 2, eTag: 'two' },
        { partNumber: 1, eTag: 'one' },
      ],
    });

    expect(storage.completeMultipartUpload).toHaveBeenCalledWith('workspaces/key', 's3-id', [
      { partNumber: 1, eTag: 'one' },
      { partNumber: 2, eTag: 'two' },
    ]);
    expect(assetModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storageProvider: 's3',
        url: 'https://cdn.example.com/workspaces/key',
      }),
    );
    expect(upload.status).toBe('completed');
    expect(save).toHaveBeenCalled();
    expect(result).toEqual({ id: 'asset-id' });
  });

  it('keeps legacy external deletion compatible without touching S3', async () => {
    const deleteOne = jest.fn().mockResolvedValue(undefined);
    assetModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        storageProvider: 'external',
        storageKey: null,
        deleteOne,
      }),
    });

    await service.remove(workspaceId, new Types.ObjectId().toHexString());

    expect(storage.deleteObjectAndInvalidate).not.toHaveBeenCalled();
    expect(deleteOne).toHaveBeenCalled();
  });

  it('purges S3 and CloudFront before removing an S3 asset record', async () => {
    const deleteOne = jest.fn().mockResolvedValue(undefined);
    assetModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        storageProvider: 's3',
        storageKey: 'workspaces/key',
        deleteOne,
      }),
    });
    storage.deleteObjectAndInvalidate.mockResolvedValue(undefined);

    await service.remove(workspaceId, new Types.ObjectId().toHexString());

    expect(storage.deleteObjectAndInvalidate).toHaveBeenCalledWith('workspaces/key');
    expect(deleteOne).toHaveBeenCalled();
  });

  it('retains the asset record when storage deletion fails', async () => {
    const deleteOne = jest.fn();
    assetModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        storageProvider: 's3',
        storageKey: 'workspaces/key',
        deleteOne,
      }),
    });
    storage.deleteObjectAndInvalidate.mockRejectedValue(new Error('CloudFront unavailable'));

    await expect(service.remove(workspaceId, new Types.ObjectId().toHexString())).rejects.toThrow(
      'CloudFront unavailable',
    );
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('paginates the library and reports whether more results exist', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `asset-${i}`,
      createdAt: new Date(2024, 0, i + 1),
    }));
    const exec = jest.fn().mockResolvedValue(items);
    const limit = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ limit });
    assetModel.find.mockReturnValue({ sort });

    const result = await service.list(workspaceId, 'image', undefined, undefined, 2);

    expect(limit).toHaveBeenCalledWith(3);
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe(items[1].createdAt.toISOString());
  });

  it('updates tags on an existing asset', async () => {
    const exec = jest.fn().mockResolvedValue({ id: 'asset-id', tags: ['a', 'b'] });
    assetModel.findOneAndUpdate.mockReturnValue({ exec });

    const result = await service.update(workspaceId, new Types.ObjectId().toHexString(), [
      'a',
      'b',
    ]);

    expect(result).toEqual({ id: 'asset-id', tags: ['a', 'b'] });
    expect(assetModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: new Types.ObjectId(workspaceId) }),
      { $set: { tags: ['a', 'b'] } },
      { new: true },
    );
  });

  it('records usage atomically for a deduplicated set of asset ids', async () => {
    const exec = jest.fn().mockResolvedValue(undefined);
    assetModel.updateMany.mockReturnValue({ exec });
    const id = new Types.ObjectId();

    await service.recordUsage(workspaceId, [id, id.toString()]);

    expect(assetModel.updateMany).toHaveBeenCalledWith(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        _id: { $in: [id] },
      },
      { $inc: { usedCount: 1 }, $set: { lastUsedAt: expect.any(Date) } },
    );
  });

  it('does not call the database when recording usage for an empty set', async () => {
    await service.recordUsage(workspaceId, []);
    expect(assetModel.updateMany).not.toHaveBeenCalled();
  });

  it('resolves imageUrl from the stored asset, ignoring a spoofed client url', async () => {
    const assetId = new Types.ObjectId();
    assetModel.find.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([{ id: assetId.toString(), _id: assetId, url: 'https://real.example.com/a.png' }]),
    });

    const result = await service.resolveImages(
      workspaceId,
      ['https://spoofed.example.com/a.png'],
      [assetId.toString()],
    );

    expect(result).toEqual([{ imageUrl: 'https://real.example.com/a.png', mediaAssetId: assetId }]);
  });

  it('rejects a mediaAssetId that does not belong to the workspace', async () => {
    assetModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    await expect(
      service.resolveImages(workspaceId, ['https://example.com/a.png'], [
        new Types.ObjectId().toHexString(),
      ]),
    ).rejects.toMatchObject({ code: 'MEDIA_ASSET_NOT_FOUND' });
  });

  it('falls back to URL-workspace validation for slides without a mediaAssetId', async () => {
    assetModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

    const result = await service.resolveImages(workspaceId, ['https://example.com/a.png']);

    expect(result).toEqual([{ imageUrl: 'https://example.com/a.png', mediaAssetId: null }]);
    expect(assetModel.countDocuments).toHaveBeenCalled();
  });
});
