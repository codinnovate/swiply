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

  it('renders slides of mixed shapes into a vertical video over a looped track', async () => {
    const slides = [join(dir, 'portrait.jpg'), join(dir, 'landscape.jpg')];
    const track = join(dir, 'track.mp3');
    const output = join(dir, 'slideshow.mp4');
    await generateJpeg(slides[0], 1080, 1350);
    await generateJpeg(slides[1], 1200, 800);
    // Shorter than the 6s slideshow, so the track has to loop to cover it.
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', track]);

    await ffmpeg.renderSlideshowVideo(slides, track, output);

    const info = await runFfmpeg(['-hide_banner', '-i', output], true);
    expect(info).toMatch(/Video: h264.*1080x1920/);
    expect(info).toMatch(/Audio: aac/);
    const [, minutes, seconds] = info.match(/Duration: 00:(\d\d):(\d\d\.\d\d)/) ?? [];
    expect(Number(minutes) * 60 + Number(seconds)).toBeCloseTo(6, 0);
  }, 60_000);
});

function generateJpeg(path: string, width: number, height: number) {
  return runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=red:s=${width}x${height}`,
    '-frames:v',
    '1',
    path,
  ]).then(() => undefined);
}

/** Runs ffmpeg-static and resolves with stderr; `probe` tolerates the non-zero exit of `-i` alone. */
function runFfmpeg(args: string[], probe = false) {
  const binary = ffmpegPath;
  if (!binary) throw new Error('ffmpeg-static is missing');
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, args);
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 || probe ? resolve(stderr) : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
}
