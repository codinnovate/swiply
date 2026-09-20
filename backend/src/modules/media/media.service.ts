import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { CompleteMediaUploadDto } from './dto/complete-media-upload.dto';
import { InitiateMediaUploadDto } from './dto/initiate-media-upload.dto';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';
import { MediaUpload, MediaUploadDocument } from './schemas/media-upload.schema';
import {
  S3StorageService,
  UPLOAD_PART_SIZE,
  UPLOAD_SESSION_TTL_MS,
  UPLOAD_URL_TTL_SECONDS,
} from './s3-storage.service';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    @InjectModel(MediaUpload.name) private readonly uploadModel: Model<MediaUploadDocument>,
    private readonly storage: S3StorageService,
  ) {}

  async initiate(workspaceId: string, userId: string, dto: InitiateMediaUploadDto) {
    this.validateUpload(dto);
    this.storage.assertConfigured();
    const storageKey = this.storage.buildObjectKey(workspaceId, dto.fileName);
    const s3UploadId = await this.storage.createMultipartUpload(
      storageKey,
      dto.mimeType,
      workspaceId,
    );
    const partCount = Math.ceil(dto.sizeBytes / UPLOAD_PART_SIZE);
    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS);

    try {
      const upload = await this.uploadModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        uploadedByUserId: new Types.ObjectId(userId),
        storageKey,
        s3UploadId,
        fileName: dto.fileName,
        mimeType: dto.mimeType.toLowerCase(),
        sizeBytes: dto.sizeBytes,
        type: dto.type,
        tags: dto.tags ?? [],
        width: dto.width ?? null,
        height: dto.height ?? null,
        partSize: UPLOAD_PART_SIZE,
        partCount,
        status: 'pending',
        expiresAt,
      });
      return {
        id: upload.id,
        partSize: UPLOAD_PART_SIZE,
        partCount,
        expiresAt,
        partUrlExpiresIn: UPLOAD_URL_TTL_SECONDS,
      };
    } catch (error) {
      await this.storage.abortMultipartUpload(storageKey, s3UploadId).catch(() => undefined);
      throw error;
    }
  }

  async signParts(workspaceId: string, id: string, partNumbers: number[]) {
    const upload = await this.findPendingUpload(workspaceId, id);
    if (partNumbers.some((partNumber) => partNumber > upload.partCount)) {
      throw ApiException.unprocessable(
        'MEDIA_UPLOAD_INVALID',
        'A requested part number exceeds the upload part count',
      );
    }
    const parts = await Promise.all(
      partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await this.storage.signPart(upload.storageKey, upload.s3UploadId, partNumber),
      })),
    );
    return { parts, expiresIn: UPLOAD_URL_TTL_SECONDS };
  }

  async complete(workspaceId: string, id: string, dto: CompleteMediaUploadDto) {
    if (!isValidObjectId(id)) throw ApiException.notFound('Media upload');
    const upload = await this.uploadModel
      .findOne({
        _id: new Types.ObjectId(id),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();
    if (!upload) throw ApiException.notFound('Media upload');

    const existing = await this.assetModel.findOne({ storageKey: upload.storageKey }).exec();
    if (existing) return existing;
    if (upload.status !== 'pending' || upload.expiresAt.getTime() <= Date.now()) {
      throw ApiException.unprocessable('MEDIA_UPLOAD_INVALID', 'Media upload is no longer active');
    }

    const parts = [...dto.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (
      parts.length !== upload.partCount ||
      parts.some((part, index) => part.partNumber !== index + 1)
    ) {
      throw ApiException.unprocessable(
        'MEDIA_UPLOAD_INVALID',
        'Every upload part must be supplied exactly once',
      );
    }

    try {
      await this.storage.completeMultipartUpload(upload.storageKey, upload.s3UploadId, parts);
    } catch (error) {
      if (this.errorName(error) !== 'NoSuchUpload') throw error;
    }

    const stored = await this.storage.headObject(upload.storageKey);
    if (stored.sizeBytes !== upload.sizeBytes || stored.mimeType !== upload.mimeType) {
      upload.status = 'failed';
      await upload.save();
      await this.storage.deleteObjectAndInvalidate(upload.storageKey);
      throw ApiException.unprocessable(
        'MEDIA_UPLOAD_INVALID',
        'Uploaded object size or content type does not match the upload session',
      );
    }

    try {
      const asset = await this.assetModel.create({
        workspaceId: upload.workspaceId,
        uploadedByUserId: upload.uploadedByUserId,
        url: this.storage.publicUrl(upload.storageKey),
        storageProvider: 's3',
        storageKey: upload.storageKey,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        type: upload.type,
        tags: upload.tags,
        width: upload.width,
        height: upload.height,
      });
      upload.status = 'completed';
      await upload.save();
      return asset;
    } catch (error) {
      if (this.mongoErrorCode(error) === 11000) {
        const asset = await this.assetModel.findOne({ storageKey: upload.storageKey }).exec();
        if (asset) return asset;
      }
      throw error;
    }
  }

  async abort(workspaceId: string, id: string): Promise<void> {
    const upload = await this.findPendingUpload(workspaceId, id);
    await this.storage.abortMultipartUpload(upload.storageKey, upload.s3UploadId);
    upload.status = 'aborted';
    await upload.save();
  }

  async list(
    workspaceId: string,
    type?: 'image' | 'video',
    tag?: string,
    cursor?: string,
    limit = 100,
  ) {
    const filter: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (type) filter.type = type;
    if (tag) filter.tags = tag;
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) filter.createdAt = { $lt: cursorDate };
    }
    const capped = Math.min(Math.max(limit, 1), 200);
    const items = await this.assetModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(capped + 1)
      .exec();
    const hasMore = items.length > capped;
    const page = hasMore ? items.slice(0, capped) : items;
    return {
      items: page,
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  async update(workspaceId: string, id: string, tags: string[]) {
    if (!isValidObjectId(id)) throw ApiException.notFound('Media asset');
    const asset = await this.assetModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), workspaceId: new Types.ObjectId(workspaceId) },
        { $set: { tags } },
        { new: true },
      )
      .exec();
    if (!asset) throw ApiException.notFound('Media asset');
    return asset;
  }

  async recordUsage(
    workspaceId: string,
    mediaAssetIds: (Types.ObjectId | string)[],
  ): Promise<void> {
    const ids = [...new Set(mediaAssetIds.map((id) => id.toString()))]
      .filter((id) => isValidObjectId(id))
      .map((id) => new Types.ObjectId(id));
    if (!ids.length) return;
    await this.assetModel
      .updateMany(
        { workspaceId: new Types.ObjectId(workspaceId), _id: { $in: ids } },
        { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } },
      )
      .exec();
  }

  async remove(workspaceId: string, id: string) {
    if (!isValidObjectId(id)) throw ApiException.notFound('Media asset');
    const asset = await this.assetModel
      .findOne({
        _id: new Types.ObjectId(id),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();
    if (!asset) throw ApiException.notFound('Media asset');
    if (asset.storageProvider === 's3' && asset.storageKey) {
      await this.storage.deleteObjectAndInvalidate(asset.storageKey);
    }
    await asset.deleteOne();
  }

  async assertImagesBelongToWorkspace(workspaceId: string, urls: string[]): Promise<void> {
    if (!urls.length) return;
    const count = await this.assetModel
      .countDocuments({
        workspaceId: new Types.ObjectId(workspaceId),
        type: 'image',
        url: { $in: urls },
      })
      .exec();
    if (count !== new Set(urls).size) {
      throw ApiException.unprocessable(
        'MEDIA_ASSET_NOT_FOUND',
        'Every supplied image must be uploaded to this workspace',
      );
    }
  }

  /**
   * Resolves each slide's authoritative imageUrl. When a mediaAssetId is supplied for a
   * slide, the asset's stored url wins over any client-supplied imageUrl for that slot,
   * preventing a caller from claiming an asset id while pointing at an arbitrary URL.
   */
  async resolveImages(
    workspaceId: string,
    imageUrls: string[],
    mediaAssetIds?: (string | null | undefined)[],
  ): Promise<{ imageUrl: string; mediaAssetId: Types.ObjectId | null }[]> {
    if (!imageUrls.length) return [];
    const idByIndex = imageUrls.map((_, index) => mediaAssetIds?.[index] ?? null);
    const requestedIds = idByIndex.filter((id): id is string => !!id && isValidObjectId(id));
    const assetsById = new Map<string, MediaAssetDocument>();
    if (requestedIds.length) {
      const assets = await this.assetModel
        .find({
          workspaceId: new Types.ObjectId(workspaceId),
          type: 'image',
          _id: { $in: requestedIds.map((id) => new Types.ObjectId(id)) },
        })
        .exec();
      for (const asset of assets) assetsById.set(asset.id, asset);
      if (assetsById.size !== new Set(requestedIds).size) {
        throw ApiException.unprocessable(
          'MEDIA_ASSET_NOT_FOUND',
          'Every supplied media asset must belong to this workspace',
        );
      }
    }
    const urlOnlyUrls = imageUrls.filter((_, index) => !idByIndex[index]);
    if (urlOnlyUrls.length) await this.assertImagesBelongToWorkspace(workspaceId, urlOnlyUrls);

    return imageUrls.map((imageUrl, index) => {
      const id = idByIndex[index];
      if (id) {
        const asset = assetsById.get(id);
        return { imageUrl: asset!.url, mediaAssetId: asset!._id as Types.ObjectId };
      }
      return { imageUrl, mediaAssetId: null };
    });
  }

  async assertVideoBelongsToWorkspace(workspaceId: string, url: string): Promise<void> {
    const exists = await this.assetModel.exists({
      workspaceId: new Types.ObjectId(workspaceId),
      type: 'video',
      url,
    });
    if (!exists) {
      throw ApiException.unprocessable(
        'MEDIA_ASSET_NOT_FOUND',
        'The supplied video must be uploaded to this workspace',
      );
    }
  }

  private validateUpload(dto: InitiateMediaUploadDto): void {
    const mimeType = dto.mimeType.toLowerCase();
    const allowed = dto.type === 'image' ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES;
    const maxBytes = dto.type === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (!allowed.has(mimeType)) {
      throw ApiException.unprocessable(
        'MEDIA_UPLOAD_INVALID',
        `Unsupported ${dto.type} content type`,
      );
    }
    if (dto.sizeBytes > maxBytes) {
      throw new ApiException(
        'MEDIA_UPLOAD_INVALID',
        `${dto.type === 'image' ? 'Images' : 'Videos'} may not exceed ${dto.type === 'image' ? '50 MB' : '2 GB'}`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  private async findPendingUpload(workspaceId: string, id: string): Promise<MediaUploadDocument> {
    if (!isValidObjectId(id)) throw ApiException.notFound('Media upload');
    const upload = await this.uploadModel
      .findOne({
        _id: new Types.ObjectId(id),
        workspaceId: new Types.ObjectId(workspaceId),
        status: 'pending',
      })
      .exec();
    if (!upload) throw ApiException.notFound('Media upload');
    if (upload.expiresAt.getTime() <= Date.now()) {
      throw ApiException.unprocessable('MEDIA_UPLOAD_INVALID', 'Media upload has expired');
    }
    return upload;
  }

  private errorName(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : undefined;
  }

  private mongoErrorCode(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'code' in error
      ? Number((error as { code: unknown }).code)
      : undefined;
  }
}
