import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ApiException } from '../../common/errors/api.exception';
import { FfmpegService } from './ffmpeg.service';
import { downloadRemoteImage } from './remote-media';
import { S3StorageService } from './s3-storage.service';
import { pickSlideshowTrack, slideshowVideoStorageKey } from './slideshow-video';

const DOWNLOAD_CONCURRENCY = 4;

/**
 * Turns a TikTok slideshow into an MP4 over a royalty-free track, for
 * publishing providers (Buffer) that cannot ask TikTok to add music itself.
 */
@Injectable()
export class SlideshowVideoService {
  private readonly trackKeys: string[];

  constructor(
    private readonly storage: S3StorageService,
    private readonly ffmpeg: FfmpegService,
    config: ConfigService,
  ) {
    this.trackKeys = config.get<string[]>('storage.slideshowMusicTrackKeys') ?? [];
  }

  async renderWithMusic(workspaceId: string, imageUrls: string[]): Promise<string> {
    if (!imageUrls.length) {
      throw ApiException.unprocessable(
        'MEDIA_TRANSCODE_FAILED',
        'A slideshow video needs at least one image',
      );
    }
    if (!this.trackKeys.length) {
      throw ApiException.unprocessable(
        'SLIDESHOW_MUSIC_NOT_CONFIGURED',
        'No music tracks are configured for TikTok slideshows sent through Buffer',
      );
    }
    const trackKey = pickSlideshowTrack(this.trackKeys, imageUrls);
    const outputKey = slideshowVideoStorageKey(workspaceId, imageUrls, trackKey);
    if (await this.storage.objectExists(outputKey)) return this.storage.publicUrl(outputKey);

    const workDir = await mkdtemp(join(tmpdir(), 'swiply-slideshow-'));
    const audioPath = join(workDir, 'track.mp3');
    const outputPath = join(workDir, 'slideshow.mp4');
    try {
      const [imagePaths] = await Promise.all([
        this.downloadSlides(workDir, imageUrls),
        this.storage.getObject(trackKey).then((track) => writeFile(audioPath, track)),
      ]);
      await this.ffmpeg.renderSlideshowVideo(imagePaths, audioPath, outputPath);
      await this.storage.putObject(outputKey, await readFile(outputPath), 'video/mp4', workspaceId);
      return this.storage.publicUrl(outputKey);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw ApiException.unprocessable(
        'MEDIA_TRANSCODE_FAILED',
        'Could not render this slideshow as a TikTok video',
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async downloadSlides(workDir: string, imageUrls: string[]): Promise<string[]> {
    const paths = imageUrls.map((_, index) => join(workDir, `slide-${index}`));
    const pending = imageUrls.map((url, index) => ({ url, index }));
    const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, pending.length) }, async () => {
      while (pending.length) {
        const next = pending.shift();
        if (!next) return;
        await writeFile(paths[next.index], await downloadRemoteImage(next.url));
      }
    });
    await Promise.all(workers);
    return paths;
  }
}
