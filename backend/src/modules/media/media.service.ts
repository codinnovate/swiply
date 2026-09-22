import { HttpStatus, Injectable, Logger } from '@nestjs/common';
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
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};
const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const REMOTE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const PINIMG_HOST = /(^|\.)pinimg\.com$/i;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    @InjectModel(MediaUpload.name) private readonly uploadModel: Model<MediaUploadDocument>,
    private readonly storage: S3StorageService,
  ) {}

  async importRemoteImage(
    workspaceId: string,
    userId: string,
    input: {
      url: string;
      fileName: string;
      tags?: string[];
      width?: number | null;
      height?: number | null;
      fingerprint?: string;
    },
  ): Promise<{ asset: MediaAssetDocument; created: boolean }> {
    this.storage.assertConfigured();
    if (input.fingerprint) {
      const existing = await this.assetModel
        .findOne({
          workspaceId: new Types.ObjectId(workspaceId),
          tags: input.fingerprint,
        })
        .exec();
      if (existing) return { asset: existing, created: false };
    }

    const { body, mimeType } = await this.downloadAllowedImage(input.url);
    const storageKey = this.storage.buildObjectKey(workspaceId, input.fileName);
    await this.storage.putObject(storageKey, body, mimeType, workspaceId);
    const tags = [...new Set([...(input.tags ?? []), ...(input.fingerprint ? [input.fingerprint] : [])])];

    try {
      const asset = await this.assetModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        uploadedByUserId: new Types.ObjectId(userId),
        url: this.storage.publicUrl(storageKey),
        storageProvider: 's3',
        storageKey,
        fileName: input.fileName,
        mimeType,
        sizeBytes: body.byteLength,
        type: 'image',
        tags,
        width: input.width ?? null,
        height: input.height ?? null,
      });
      return { asset, created: true };
    } catch (error) {
      await this.storage.deleteObjectAndInvalidate(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async downloadAllowedImage(url: string): Promise<{ body: Buffer; mimeType: string }> {
    this.assertSafePinImageUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { Accept: 'image/*' },
      });
    } catch {
      throw ApiException.unprocessable('MEDIA_UPLOAD_FAILED', 'Could not download the Pinterest image');
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw ApiException.unprocessable('REMOTE_MEDIA_UNSAFE', 'Redirect had no location');
      this.assertSafePinImageUrl(new URL(location, url).toString());
      throw ApiException.unprocessable(
        'REMOTE_MEDIA_UNSAFE',
        'Redirects are not followed for Pinterest imports',
      );
    }
    if (!response.ok) {
      throw ApiException.unprocessable('MEDIA_UPLOAD_FAILED', 'Pinterest image download failed');
    }
    const mimeType = (response.headers.get('content-type') ?? 'image/jpeg').split(';', 1)[0].toLowerCase();
    if (!IMAGE_MIME_TYPES.has(mimeType)) {
      throw ApiException.unprocessable('MEDIA_UPLOAD_INVALID', 'Pinterest pin is not a supported image type');
    }
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > REMOTE_IMAGE_MAX_BYTES) {
      throw ApiException.unprocessable('MEDIA_UPLOAD_INVALID', 'Pinterest image exceeds 15 MB');
    }
    return { body, mimeType };
  }

  assertSafePinImageUrl(raw: string): void {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new ApiException('REMOTE_MEDIA_UNSAFE', 'Invalid image URL', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (parsed.protocol !== 'https:') {
      throw new ApiException('REMOTE_MEDIA_UNSAFE', 'Image URL must be https', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!PINIMG_HOST.test(parsed.hostname)) {
      throw new ApiException(
        'REMOTE_MEDIA_UNSAFE',
        'Only Pinterest CDN image URLs can be imported',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async initiate(workspaceId: string, userId: string, dto: InitiateMediaUploadDto) {
    const mimeType = this.normalizeMime(dto.fileName, dto.mimeType);
    this.validateUpload({ ...dto, mimeType });
    this.storage.assertConfigured();
    const storageKey = this.storage.buildObjectKey(workspaceId, dto.fileName);
    const s3UploadId = await this.storage.createMultipartUpload(
      storageKey,
      mimeType,
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
        mimeType,
        sizeBytes: dto.sizeBytes,
        type: IMAGE_MIME_TYPES.has(mimeType) ? 'image' : 'video',
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

    let listed: Array<{ partNumber: number; eTag: string }> = [];
    try {
      listed = await this.storage.listParts(upload.storageKey, upload.s3UploadId);
    } catch {
      listed = [];
    }
    const supplied = [...dto.parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .flatMap((part) => (part.eTag ? [{ partNumber: part.partNumber, eTag: part.eTag }] : []));
    const parts = listed.length === upload.partCount ? listed : supplied;
    if (
      parts.length !== upload.partCount ||
      parts.some((part, index) => part.partNumber !== index + 1 || !part.eTag)
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
      await this.storage.deleteObjectAndInvalidate(upload.storageKey).catch(() => undefined);
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
        fileName: upload.fileName,
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
      try {
        await this.storage.deleteObjectAndInvalidate(asset.storageKey);
      } catch (error) {
        this.logger.warn(
          `Could not delete stored media ${asset.storageKey}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
    await asset.deleteOne();
  }

  async listImages(workspaceId: string, limit = 100) {
    return this.assetModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        type: 'image',
      })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 2), 200))
      .exec();
  }

  async getImagesByIds(workspaceId: string, ids: string[]) {
    const unique = [...new Set(ids.filter((id) => isValidObjectId(id)))];
    if (!unique.length) return [];
    const assets = await this.assetModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        type: 'image',
        _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
      })
      .exec();
    if (assets.length !== unique.length) {
      throw ApiException.unprocessable(
        'MEDIA_ASSET_NOT_FOUND',
        'Every supplied media asset must belong to this workspace',
      );
    }
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    return ids.flatMap((id) => {
      const asset = byId.get(id);
      return asset ? [asset] : [];
    });
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

  private normalizeMime(fileName: string, mimeType: string): string {
    let mime = mimeType.toLowerCase().split(';', 1)[0].trim();
    if (mime === 'image/jpg') mime = 'image/jpeg';
    if (!IMAGE_MIME_TYPES.has(mime) && !VIDEO_MIME_TYPES.has(mime)) {
      const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
      mime = MIME_BY_EXTENSION[extension] ?? mime;
    }
    return mime;
  }

  private validateUpload(dto: InitiateMediaUploadDto): void {
    const mimeType = this.normalizeMime(dto.fileName, dto.mimeType);
    const inferredType = IMAGE_MIME_TYPES.has(mimeType)
      ? 'image'
      : VIDEO_MIME_TYPES.has(mimeType)
        ? 'video'
        : dto.type;
    const allowed = inferredType === 'image' ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES;
    const maxBytes = inferredType === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (!allowed.has(mimeType)) {
      throw ApiException.unprocessable(
        'MEDIA_UPLOAD_INVALID',
        `Unsupported ${dto.type} content type`,
      );
    }
    if (dto.sizeBytes > maxBytes) {
      throw new ApiException(
        'MEDIA_UPLOAD_INVALID',
        `${inferredType === 'image' ? 'Images' : 'Videos'} may not exceed ${inferredType === 'image' ? '50 MB' : '2 GB'}`,
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
