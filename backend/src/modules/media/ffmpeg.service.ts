import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

import { ApiException } from '../../common/errors/api.exception';
import { fitTikTokDimensions, parseFfmpegSize } from './tiktok-image-fit';

const TRANSCODE_TIMEOUT_MS = 60_000;

@Injectable()
export class FfmpegService {
  async probeSize(inputPath: string): Promise<{ width: number; height: number }> {
    const { stderr } = await this.run(['-hide_banner', '-i', inputPath]);
    const size = parseFfmpegSize(stderr);
    if (!size) {
      throw ApiException.unprocessable(
        'MEDIA_TRANSCODE_FAILED',
        'Could not read image dimensions with FFmpeg',
      );
    }
    return size;
  }

  async scaleToJpeg(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
  ): Promise<void> {
    const { code, stderr } = await this.run([
      '-y',
      '-i',
      inputPath,
      '-vf',
      `scale=${width}:${height}`,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      outputPath,
    ]);
    if (code !== 0) {
      throw ApiException.unprocessable(
        'MEDIA_TRANSCODE_FAILED',
        'FFmpeg could not resize the image for TikTok',
        { stderr: stderr.slice(-800) },
      );
    }
  }

  async fitToTikTokJpeg(inputPath: string, outputPath: string): Promise<{ width: number; height: number }> {
    const probed = await this.probeSize(inputPath);
    const fitted = fitTikTokDimensions(probed.width, probed.height);
    await this.scaleToJpeg(inputPath, outputPath, fitted.width, fitted.height);
    return fitted;
  }

  private binary(): string {
    if (!ffmpegPath) {
      throw ApiException.unprocessable(
        'MEDIA_TRANSCODE_FAILED',
        'FFmpeg is not available on this server',
      );
    }
    return ffmpegPath;
  }

  private run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(
          ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'FFmpeg timed out while resizing an image'),
        );
      }, TRANSCODE_TIMEOUT_MS);
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(
          ApiException.unprocessable(
            'MEDIA_TRANSCODE_FAILED',
            error instanceof Error ? error.message : 'FFmpeg failed to start',
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
  }
}
