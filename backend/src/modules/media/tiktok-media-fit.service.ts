import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Model, Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { FfmpegService } from './ffmpeg.service';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';
import { S3StorageService } from './s3-storage.service';
import {
  needsTikTokFit,
  tiktokFitStorageKey,
} from './tiktok-image-fit';

const DOWNLOAD_TIMEOUT_MS = 20_000;
const DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;

@Injectable()
export class TikTokMediaFitService {
  constructor(
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    private readonly storage: S3StorageService,
    private readonly ffmpeg: FfmpegService,
  ) {}

  async fitAll(workspaceId: string, imageUrls: string[]): Promise<string[]> {
    const fitted = new Array<string>(imageUrls.length);
    const pending = imageUrls.map((url, index) => ({ url, index }));
    const workers = Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (pending.length) {
        const next = pending.shift();
        if (!next) return;
        fitted[next.index] = await this.fitOne(workspaceId, next.url);
      }
    });
    await Promise.all(workers);
    return fitted;
  }

  async fitOne(workspaceId: string, imageUrl: string): Promise<string> {
    if (imageUrl.includes('.tiktok.jpg')) return imageUrl;
    const asset = await this.assets
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), url: imageUrl })
      .exec();
    if (
      asset &&
      !needsTikTokFit(asset.width, asset.height, asset.mimeType)
    ) {
      return asset.url;
    }

    const sourceKey = asset?.storageKey ?? null;
    const outputKey = sourceKey
      ? tiktokFitStorageKey(sourceKey)
      : `workspaces/${workspaceId}/tiktok-fit/${hashUrl(imageUrl)}.tiktok.jpg`;
    if (await this.storage.objectExists(outputKey)) {
      return this.storage.publicUrl(outputKey);
    }

    const input = await this.readSource(imageUrl, sourceKey);
    const workDir = await mkdtemp(join(tmpdir(), 'swiply-tiktok-'));
    const inputPath = join(workDir, 'in.bin');
    const outputPath = join(workDir, 'out.jpg');
    try {
      await writeFile(inputPath, input);
      await this.ffmpeg.fitToTikTokJpeg(inputPath, outputPath);
      const jpeg = await readFile(outputPath);
      await this.storage.putObject(outputKey, jpeg, 'image/jpeg', workspaceId);
      return this.storage.publicUrl(outputKey);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw ApiException.unprocessable(
        'MEDIA_TRANSCODE_FAILED',
        'Could not prepare this image for TikTok',
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async readSource(imageUrl: string, storageKey: string | null): Promise<Buffer> {
    if (storageKey) {
      try {
        return await this.storage.getObject(storageKey);
      } catch (error) {
        if (error instanceof ApiException && error.code === 'STORAGE_NOT_CONFIGURED') throw error;
      }
    }
    return this.download(imageUrl);
  }

  private async download(imageUrl: string): Promise<Buffer> {
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Image URL is not valid');
    }
    if (url.protocol !== 'https:') {
      throw ApiException.unprocessable('REMOTE_MEDIA_UNSAFE', 'TikTok images must be fetched over HTTPS');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: 'error',
        headers: { Accept: 'image/*' },
      });
    } catch {
      throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Could not download the image to resize');
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Could not download the image to resize');
    }
    const length = Number(response.headers.get('content-length') || 0);
    if (length > DOWNLOAD_MAX_BYTES) {
      throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Image is too large to resize');
    }
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > DOWNLOAD_MAX_BYTES) {
      throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Image is too large to resize');
    }
    return body;
  }
}

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 20);
}
