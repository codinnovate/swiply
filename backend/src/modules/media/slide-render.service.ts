import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Model, Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { FfmpegService } from './ffmpeg.service';
import { downloadRemoteImage } from './remote-media';
import { S3StorageService } from './s3-storage.service';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';
import {
  SLIDE_CAPTION_FONT,
  layoutCaption,
  slideRenderStorageKey,
  type SlideFrame,
} from './slide-render';

const RENDER_CONCURRENCY = 3;

export interface SlideToRender {
  imageUrl: string;
  caption?: string | null;
}

/**
 * Produces the images a slideshow is actually published with: each slide
 * cropped to the platform's frame with its caption drawn on, stored once per
 * image + caption so retries and re-publishes reuse the render.
 */
@Injectable()
export class SlideRenderService {
  constructor(
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    private readonly storage: S3StorageService,
    private readonly ffmpeg: FfmpegService,
  ) {}

  async renderAll(workspaceId: string, slides: SlideToRender[], frame: SlideFrame): Promise<string[]> {
    const rendered = new Array<string>(slides.length);
    const pending = slides.map((slide, index) => ({ slide, index }));
    const workers = Array.from({ length: Math.min(RENDER_CONCURRENCY, pending.length) }, async () => {
      while (pending.length) {
        const next = pending.shift();
        if (!next) return;
        rendered[next.index] = await this.renderOne(workspaceId, next.slide, frame);
      }
    });
    await Promise.all(workers);
    return rendered;
  }

  async renderOne(workspaceId: string, slide: SlideToRender, frame: SlideFrame): Promise<string> {
    const outputKey = slideRenderStorageKey(workspaceId, slide.imageUrl, slide.caption, frame);
    if (await this.storage.objectExists(outputKey)) return this.storage.publicUrl(outputKey);

    const caption = layoutCaption(slide.caption ?? '', frame);
    const source = await this.readSource(workspaceId, slide.imageUrl);
    const workDir = await mkdtemp(join(tmpdir(), 'swiply-slide-'));
    const inputPath = join(workDir, 'in.bin');
    const outputPath = join(workDir, 'out.jpg');
    const lineFiles = (caption?.lines ?? []).map((_, index) => join(workDir, `line-${index}.txt`));
    try {
      await Promise.all([
        writeFile(inputPath, source),
        ...lineFiles.map((path, index) => writeFile(path, caption?.lines[index] ?? '', 'utf8')),
      ]);
      await this.ffmpeg.renderSlideImage({
        inputPath,
        outputPath,
        frame,
        caption,
        lineFiles,
        fontPath: SLIDE_CAPTION_FONT,
      });
      await this.storage.putObject(outputKey, await readFile(outputPath), 'image/jpeg', workspaceId);
      return this.storage.publicUrl(outputKey);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Could not prepare this slide for publishing');
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  /** Library uploads are read straight from the bucket; anything else is downloaded. */
  private async readSource(workspaceId: string, imageUrl: string): Promise<Buffer> {
    const asset = await this.assets
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), url: imageUrl })
      .lean()
      .exec();
    if (asset?.storageKey) {
      try {
        return await this.storage.getObject(asset.storageKey);
      } catch (error) {
        if (error instanceof ApiException && error.code === 'STORAGE_NOT_CONFIGURED') throw error;
      }
    }
    return downloadRemoteImage(imageUrl);
  }
}
