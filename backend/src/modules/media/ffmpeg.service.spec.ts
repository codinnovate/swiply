import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

import { FfmpegService } from './ffmpeg.service';
import { TIKTOK_MAX_PIXELS } from './tiktok-image-fit';

describe('FfmpegService', () => {
  const ffmpeg = new FfmpegService();
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'swiply-ffmpeg-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('scales an oversized square to TikTok’s pixel cap', async () => {
    const input = join(dir, 'in.jpg');
    const output = join(dir, 'out.jpg');
    await generateJpeg(input, 1536, 1536);
    const fitted = await ffmpeg.fitToTikTokJpeg(input, output);
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(TIKTOK_MAX_PIXELS);
    expect(await ffmpeg.probeSize(output)).toEqual(fitted);
  }, 30_000);
});

function generateJpeg(path: string, width: number, height: number) {
  const binary = ffmpegPath;
  if (!binary) throw new Error('ffmpeg-static is missing');
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=red:s=${width}x${height}`,
      '-frames:v',
      '1',
      path,
    ]);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}
