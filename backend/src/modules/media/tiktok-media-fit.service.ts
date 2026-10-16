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
import { downloadRemoteImage } from './remote-media';
import { S3StorageService } from './s3-storage.service';
import {
  needsTikTokFit,
  tiktokFitStorageKey,
} from './tiktok-image-fit';

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
    return downloadRemoteImage(imageUrl);
  }
}

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 20);
}
