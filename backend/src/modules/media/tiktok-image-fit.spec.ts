import {
  TIKTOK_MAX_PIXELS,
  fitTikTokDimensions,
  needsTikTokFit,
  parseFfmpegSize,
  tiktokFitStorageKey,
} from './tiktok-image-fit';

describe('tiktok-image-fit', () => {
  it('shrinks a 1536×1536 square under TikTok’s pixel cap', () => {
    expect(1536 * 1536).toBe(2_359_296);
    expect(needsTikTokFit(1536, 1536, 'image/jpeg')).toBe(true);
    const fitted = fitTikTokDimensions(1536, 1536);
    expect(fitted).toEqual({ width: 1440, height: 1440 });
    expect(fitted.width * fitted.height).toBe(TIKTOK_MAX_PIXELS);
  });

  it('leaves 1080p landscape alone after rounding', () => {
    expect(needsTikTokFit(1920, 1080, 'image/jpeg')).toBe(false);
    expect(fitTikTokDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it('caps a long side at 1920 then the pixel budget', () => {
    const fitted = fitTikTokDimensions(4000, 3000);
    expect(Math.max(fitted.width, fitted.height)).toBeLessThanOrEqual(1920);
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(TIKTOK_MAX_PIXELS);
  });

  it('forces PNG through FFmpeg even when the pixel count is legal', () => {
    expect(needsTikTokFit(800, 800, 'image/png')).toBe(true);
    expect(needsTikTokFit(800, 800, 'image/jpeg')).toBe(false);
  });

  it('parses ffmpeg probe output', () => {
    expect(
      parseFfmpegSize(
        'Stream #0:0: Video: mjpeg (Baseline), yuvj420p(pc), 1536x1536 [SAR 1:1 DAR 1:1]',
      ),
    ).toEqual({ width: 1536, height: 1536 });
  });

  it('names the derived jpeg next to the original object', () => {
    expect(tiktokFitStorageKey('workspaces/abc/uuid/hero.png')).toBe(
      'workspaces/abc/uuid/hero.tiktok.jpg',
    );
  });
});
